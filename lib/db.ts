import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

const client = createClient({
  url: process.env.DATABASE_URL || 'file:./fiscal.db',
})

export const db = drizzle(client, { schema })

// Initialize tables
export async function initDB() {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL,
      perfil TEXT NOT NULL,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fazendas (
      id TEXT PRIMARY KEY,
      ie_tomador TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notas (
      id TEXT PRIMARY KEY,
      numero TEXT NOT NULL,
      valor REAL NOT NULL,
      emissor_nome TEXT NOT NULL,
      cnpj_emissor TEXT NOT NULL DEFAULT '',
      ie_tomador TEXT NOT NULL,
      dt_emissao TEXT NOT NULL,
      importado_em TEXT NOT NULL DEFAULT (datetime('now')),
      importado_por_id TEXT NOT NULL REFERENCES usuarios(id),
      responsavel_pagamento TEXT,
      estorno_justificativa TEXT,
      estorno_em TEXT,
      estornada_por TEXT,
      UNIQUE(numero, ie_tomador, cnpj_emissor)
    );

    CREATE TABLE IF NOT EXISTS protocolos (
      id TEXT PRIMARY KEY,
      nota_id TEXT NOT NULL UNIQUE REFERENCES notas(id),
      data_recebimento TEXT NOT NULL,
      responsavel_forma_pag TEXT,
      forma_pagamento TEXT,
      pedidos TEXT,
      vencimento TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      criado_por_id TEXT NOT NULL REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS notas_canceladas (
      id TEXT PRIMARY KEY,
      numero TEXT NOT NULL,
      valor REAL NOT NULL,
      emissor_nome TEXT NOT NULL,
      cnpj_emissor TEXT NOT NULL DEFAULT '',
      ie_tomador TEXT NOT NULL,
      dt_emissao TEXT NOT NULL,
      status TEXT NOT NULL,
      importado_em TEXT NOT NULL DEFAULT (datetime('now')),
      importado_por_id TEXT NOT NULL REFERENCES usuarios(id),
      UNIQUE(numero, ie_tomador, cnpj_emissor)
    );

    CREATE TABLE IF NOT EXISTS lancamentos_fiscal (
      id TEXT PRIMARY KEY,
      protocolo_id TEXT NOT NULL UNIQUE REFERENCES protocolos(id),
      forma_pagamento TEXT,
      concluida INTEGER NOT NULL DEFAULT 0,
      concluida_em TEXT,
      identificada INTEGER NOT NULL DEFAULT 0,
      pedidos TEXT,
      vencimento TEXT,
      anotacoes TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
      responsavel_id TEXT NOT NULL REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL,
      usuario_nome TEXT NOT NULL,
      acao TEXT NOT NULL,
      descricao TEXT NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Migration: logs table (separate execute to run on existing DBs)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL,
      usuario_nome TEXT NOT NULL,
      acao TEXT NOT NULL,
      descricao TEXT NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Recovery: if a previous migration left notas_v1 behind, restore it
  const v1Check = await client.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name='notas_v1'`)
  if (v1Check.rows.length > 0) {
    const notasCount = await client.execute(`SELECT COUNT(*) as n FROM notas`)
    if ((notasCount.rows[0] as any).n === 0) {
      await client.execute(`PRAGMA foreign_keys = OFF`)
      await client.execute(`DROP TABLE notas`)
      await client.execute(`ALTER TABLE notas_v1 RENAME TO notas`)
      await client.execute(`PRAGMA foreign_keys = ON`)
    } else {
      await client.execute(`DROP TABLE notas_v1`)
    }
  }

  // Migrations: simple column additions
  for (const col of ['forma_pagamento', 'pedidos', 'vencimento']) {
    try { await client.execute(`ALTER TABLE protocolos ADD COLUMN ${col} TEXT`) } catch {}
  }
  for (const col of ['responsavel_pagamento', 'estorno_justificativa', 'estorno_em', 'estornada_por']) {
    try { await client.execute(`ALTER TABLE notas ADD COLUMN ${col} TEXT`) } catch {}
  }

  // Migration: add cnpj_emissor if missing (new DBs already have it via CREATE TABLE above)
  try { await client.execute(`ALTER TABLE notas ADD COLUMN cnpj_emissor TEXT NOT NULL DEFAULT ''`) } catch {}
  try { await client.execute(`ALTER TABLE notas_canceladas ADD COLUMN cnpj_emissor TEXT NOT NULL DEFAULT ''`) } catch {}
}

export { client }
