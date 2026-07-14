import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const db = drizzle(pool, { schema })

type Query = string | { sql: string; args?: unknown[] }

// Existing call sites were written for @libsql/client's API (`?` placeholders,
// `{ rows, rowsAffected }`) — this shim keeps that surface so the ~70 raw SQL
// call sites across the app didn't all need mechanical rewriting for the
// Postgres driver's `$1, $2, ...` placeholder style.
function toPgQuery(sql: string, args: unknown[]) {
  let i = 0
  const text = sql.replace(/\?/g, () => `$${++i}`)
  return { text, values: args }
}

async function execute(query: Query) {
  const { sql, args } = typeof query === 'string' ? { sql: query, args: [] as unknown[] } : { sql: query.sql, args: query.args ?? [] }
  const { text, values } = toPgQuery(sql, args)
  const result = await pool.query(text, values)
  return { rows: result.rows, rowsAffected: result.rowCount ?? 0 }
}

export const client = { execute, query: pool.query.bind(pool), end: pool.end.bind(pool) }

// Initialize tables
export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL,
      perfil TEXT NOT NULL,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      criado_em TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
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
      chave TEXT NOT NULL DEFAULT '',
      ie_tomador TEXT NOT NULL,
      dt_emissao TEXT NOT NULL,
      importado_em TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
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
      criado_em TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
      criado_por_id TEXT NOT NULL REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS notas_canceladas (
      id TEXT PRIMARY KEY,
      numero TEXT NOT NULL,
      valor REAL NOT NULL,
      emissor_nome TEXT NOT NULL,
      cnpj_emissor TEXT NOT NULL DEFAULT '',
      chave TEXT NOT NULL DEFAULT '',
      ie_tomador TEXT NOT NULL,
      dt_emissao TEXT NOT NULL,
      status TEXT NOT NULL,
      importado_em TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
      importado_por_id TEXT NOT NULL REFERENCES usuarios(id),
      UNIQUE(numero, ie_tomador, cnpj_emissor)
    );

    CREATE TABLE IF NOT EXISTS lancamentos_fiscal (
      id TEXT PRIMARY KEY,
      protocolo_id TEXT NOT NULL UNIQUE REFERENCES protocolos(id),
      forma_pagamento TEXT,
      concluida BOOLEAN NOT NULL DEFAULT FALSE,
      concluida_em TEXT,
      identificada BOOLEAN NOT NULL DEFAULT FALSE,
      pedidos TEXT,
      vencimento TEXT,
      anotacoes TEXT,
      criado_em TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
      atualizado_em TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
      responsavel_id TEXT NOT NULL REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL,
      usuario_nome TEXT NOT NULL,
      acao TEXT NOT NULL,
      descricao TEXT NOT NULL,
      criado_em TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    );
  `)

  // Chave is the reliable way to detect duplicate notas — unique per note, ignoring blanks from before this column existed
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_notas_chave ON notas(chave) WHERE chave != ''`)
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_notas_canceladas_chave ON notas_canceladas(chave) WHERE chave != ''`)

  // Supports "ORDER BY importado_em DESC" in /api/notas without a temp b-tree sort when the table grows large
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notas_importado_em ON notas(importado_em)`)
}
