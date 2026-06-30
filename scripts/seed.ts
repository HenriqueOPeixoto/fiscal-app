import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const FAZENDAS = [
  { ie: '132759071', nome: 'CAMILA' },
  { ie: '133404790', nome: 'PAULO GABRIEL' },
  { ie: '134016246', nome: 'PECUÁRIA' },
  { ie: '135095034', nome: 'SANTA CLARA' },
  { ie: '135402816', nome: 'GADO CORTE' },
  { ie: '135773199', nome: 'ENTRE RIOS' },
  { ie: '136281800', nome: 'GRANJA NSA SRA' },
  { ie: '138685460', nome: 'JESUI­NA' },
  { ie: '140064176', nome: 'RAFAEL DO NASCIMENTO' },
  { ie: '141495820', nome: 'PSF AGROPECUARIA LTDA' },
  { ie: '628016800001-08', nome: 'PSF AGROPECUARIA LTDA' },
]

async function seed() {
  const client = createClient({ url: 'file:./fiscal.db' })

  // Create tables
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL, perfil TEXT NOT NULL, ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS fazendas (
      id TEXT PRIMARY KEY, ie_tomador TEXT NOT NULL UNIQUE, nome TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notas (
      id TEXT PRIMARY KEY, numero TEXT NOT NULL, valor REAL NOT NULL,
      emissor_nome TEXT NOT NULL, ie_tomador TEXT NOT NULL, dt_emissao TEXT NOT NULL,
      importado_em TEXT NOT NULL DEFAULT (datetime('now')),
      importado_por_id TEXT NOT NULL REFERENCES usuarios(id),
      UNIQUE(numero, ie_tomador)
    );
    CREATE TABLE IF NOT EXISTS protocolos (
      id TEXT PRIMARY KEY, nota_id TEXT NOT NULL UNIQUE REFERENCES notas(id),
      data_recebimento TEXT NOT NULL, responsavel_forma_pag TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      criado_por_id TEXT NOT NULL REFERENCES usuarios(id)
    );
    CREATE TABLE IF NOT EXISTS lancamentos_fiscal (
      id TEXT PRIMARY KEY, protocolo_id TEXT NOT NULL UNIQUE REFERENCES protocolos(id),
      forma_pagamento TEXT, concluida INTEGER NOT NULL DEFAULT 0, concluida_em TEXT,
      identificada INTEGER NOT NULL DEFAULT 0, pedidos TEXT, vencimento TEXT,
      anotacoes TEXT, criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
      responsavel_id TEXT NOT NULL REFERENCES usuarios(id)
    );
  `)

  // Seed fazendas
  for (const f of FAZENDAS) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO fazendas (id, ie_tomador, nome) VALUES (?, ?, ?)`,
      args: [randomUUID(), f.ie, f.nome],
    })
    // Also insert with leading zeros variant
    const withZeros = f.ie.replace(/^0+/, '') !== f.ie ? f.ie : '00' + f.ie
    await client.execute({
      sql: `INSERT OR IGNORE INTO fazendas (id, ie_tomador, nome) VALUES (?, ?, ?)`,
      args: [randomUUID(), withZeros, f.nome],
    }).catch(() => {})
  }

  // Seed admin user
  const senhaHash = await bcrypt.hash('admin123', 10)
  await client.execute({
    sql: `INSERT OR IGNORE INTO usuarios (id, nome, email, senha, perfil) VALUES (?, ?, ?, ?, ?)`,
    args: [randomUUID(), 'Administrador', 'admin@empresa.com', senhaHash, 'admin'],
  })

  // Seed compras user
  const senhaCompras = await bcrypt.hash('compras123', 10)
  await client.execute({
    sql: `INSERT OR IGNORE INTO usuarios (id, nome, email, senha, perfil) VALUES (?, ?, ?, ?, ?)`,
    args: [randomUUID(), 'Compras', 'compras@empresa.com', senhaCompras, 'compras'],
  })

  // Seed fiscal user
  const senhaFiscal = await bcrypt.hash('fiscal123', 10)
  await client.execute({
    sql: `INSERT OR IGNORE INTO usuarios (id, nome, email, senha, perfil) VALUES (?, ?, ?, ?, ?)`,
    args: [randomUUID(), 'Fiscal', 'fiscal@empresa.com', senhaFiscal, 'fiscal'],
  })

  console.log('✅ Banco inicializado com sucesso!')
  console.log('Usuários criados:')
  console.log('  admin@empresa.com / admin123 (Admin)')
  console.log('  compras@empresa.com / compras123 (Compras)')
  console.log('  fiscal@empresa.com / fiscal123 (Fiscal)')
  client.close()
}

seed().catch(console.error)
