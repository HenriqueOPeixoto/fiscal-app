import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { client } from '@/lib/db'
import { log } from '@/lib/logger'
import { randomUUID } from 'crypto'

const normalizeIE = (ie: string) => String(ie).replace(/\D/g, '').replace(/^0+/, '')

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const perfil = (session.user as any).perfil
  if (perfil !== 'compras' && perfil !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await req.json()
  const numero = String(body.numero || '').trim()
  const valor = parseFloat(String(body.valor || '').replace(',', '.'))
  const emissorNome = String(body.emissorNome || '').trim()
  const cnpjEmissor = String(body.cnpjEmissor || '').replace(/\D/g, '')
  const ieTomador = normalizeIE(body.ieTomador || '')
  const chave = String(body.chave || '').replace(/\D/g, '')
  const dtEmissao = String(body.dtEmissao || '').trim()

  if (!numero || !emissorNome || !cnpjEmissor || !ieTomador || !chave || !dtEmissao || !valor || isNaN(valor)) {
    return NextResponse.json({ error: 'Preencha todos os campos obrigatórios' }, { status: 400 })
  }

  if (chave.length !== 44 && chave.length !== 50) {
    return NextResponse.json({ error: 'Chave de acesso deve ter 44 dígitos (NF-e) ou 50 dígitos (NFS-e)' }, { status: 400 })
  }

  const fazenda = await client.execute({
    sql: 'SELECT ie_tomador FROM fazendas WHERE ie_tomador = ?',
    args: [ieTomador],
  })
  if (!fazenda.rows.length) {
    // Fall back to comparing normalized IEs, since fazendas may be stored with different padding/formatting
    const todas = await client.execute('SELECT ie_tomador FROM fazendas')
    const existe = (todas.rows as any[]).some(r => normalizeIE(r.ie_tomador) === ieTomador)
    if (!existe) {
      return NextResponse.json({ error: 'Fazenda (IE) não cadastrada' }, { status: 400 })
    }
  }

  const existente = await client.execute({
    sql: `SELECT id FROM notas WHERE chave = ?
          UNION SELECT id FROM notas_canceladas WHERE chave = ?`,
    args: [chave, chave],
  })
  if (existente.rows.length) {
    return NextResponse.json({ error: 'Já existe uma nota com essa Chave' }, { status: 409 })
  }

  const userId = (session.user as any).id
  const id = randomUUID()

  await client.execute({
    sql: `INSERT INTO notas (id, numero, valor, emissor_nome, cnpj_emissor, chave, ie_tomador, dt_emissao, importado_por_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, numero, valor, emissorNome, cnpjEmissor, chave, ieTomador, dtEmissao, userId],
  })

  const userName = session.user?.name || userId
  await log(userId, userName, 'nota_manual_criada',
    `Incluiu manualmente a NF ${numero} — ${emissorNome}`)

  return NextResponse.json({ ok: true, id })
}
