import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { client, initDB } from '../lib/db'

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
  await initDB()

  // Seed fazendas
  for (const f of FAZENDAS) {
    await client.execute({
      sql: `INSERT INTO fazendas (id, ie_tomador, nome) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`,
      args: [randomUUID(), f.ie, f.nome],
    })
    // Also insert with leading zeros variant
    const withZeros = f.ie.replace(/^0+/, '') !== f.ie ? f.ie : '00' + f.ie
    await client.execute({
      sql: `INSERT INTO fazendas (id, ie_tomador, nome) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`,
      args: [randomUUID(), withZeros, f.nome],
    }).catch(() => {})
  }

  // Seed admin user
  const senhaHash = await bcrypt.hash('admin123', 10)
  await client.execute({
    sql: `INSERT INTO usuarios (id, nome, email, senha, perfil) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
    args: [randomUUID(), 'Administrador', 'admin@empresa.com', senhaHash, 'admin'],
  })

  // Seed compras user
  const senhaCompras = await bcrypt.hash('compras123', 10)
  await client.execute({
    sql: `INSERT INTO usuarios (id, nome, email, senha, perfil) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
    args: [randomUUID(), 'Compras', 'compras@empresa.com', senhaCompras, 'compras'],
  })

  // Seed fiscal user
  const senhaFiscal = await bcrypt.hash('fiscal123', 10)
  await client.execute({
    sql: `INSERT INTO usuarios (id, nome, email, senha, perfil) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
    args: [randomUUID(), 'Fiscal', 'fiscal@empresa.com', senhaFiscal, 'fiscal'],
  })

  console.log('✅ Banco inicializado com sucesso!')
  console.log('Usuários criados:')
  console.log('  admin@empresa.com / admin123 (Admin)')
  console.log('  compras@empresa.com / compras123 (Compras)')
  console.log('  fiscal@empresa.com / fiscal123 (Fiscal)')
  await client.end()
}

seed().catch(console.error)
