import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { client } from '@/lib/db'
import { log } from '@/lib/logger'
import { hojeISO } from '@/lib/date'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const perfil = (session.user as any).perfil
  if (perfil !== 'compras' && perfil !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await req.json()
  const { notaId, responsavelFormaPag, formaPagamento, pedidos, vencimento } = body
  const dataRecebimento = hojeISO()

  if (!notaId) {
    return NextResponse.json({ error: 'Dados obrigatórios faltando' }, { status: 400 })
  }

  if (!formaPagamento || !String(formaPagamento).trim()) {
    return NextResponse.json({ error: 'Forma de pagamento é obrigatória para protocolar' }, { status: 400 })
  }

  // Check if nota exists
  const nota = await client.execute({
    sql: `SELECT id, numero, emissor_nome, ie_tomador FROM notas WHERE id = ?`,
    args: [notaId],
  })
  if (!nota.rows.length) {
    return NextResponse.json({ error: 'Nota não encontrada' }, { status: 404 })
  }
  if (!(nota.rows[0] as any).ie_tomador) {
    return NextResponse.json({ error: 'Informe a IE da fazenda antes de protocolar' }, { status: 400 })
  }

  // Check if protocol already exists
  const existing = await client.execute({
    sql: `SELECT id FROM protocolos WHERE nota_id = ?`,
    args: [notaId],
  })
  if (existing.rows.length) {
    return NextResponse.json({ error: 'Nota já possui protocolo' }, { status: 409 })
  }

  const id = randomUUID()
  const userId = (session.user as any).id

  await client.execute({
    sql: `INSERT INTO protocolos (id, nota_id, data_recebimento, responsavel_forma_pag, forma_pagamento, pedidos, vencimento, criado_por_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, notaId, dataRecebimento, responsavelFormaPag || null, formaPagamento || null, pedidos || null, vencimento || null, userId],
  })

  // Clear any previous estorno justification and keep the nota's own record of these fields in sync,
  // so they survive (visible to compras) even if this protocolo is later estornado
  await client.execute({
    sql: `UPDATE notas SET estorno_justificativa = NULL, estorno_em = NULL, estornada_por = NULL,
          responsavel_pagamento = ?, forma_pagamento = ?, pedidos = ?, vencimento = ? WHERE id = ?`,
    args: [responsavelFormaPag || null, formaPagamento || null, pedidos || null, vencimento || null, notaId],
  })

  const notaRow = nota.rows[0] as any
  const userName = session.user?.name || userId
  await log(userId, userName, 'protocolo_criado',
    `Protocolou NF ${notaRow.numero} — ${notaRow.emissor_nome}`)

  return NextResponse.json({ id, success: true })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const mes = searchParams.get('mes') // format: 2026-06
  const status = searchParams.get('status') // 'pendente' | 'concluida' | 'todas'

  let sql = `
    SELECT
      p.id, p.data_recebimento, p.responsavel_forma_pag, p.criado_em,
      p.forma_pagamento, p.pedidos, p.vencimento,
      n.numero, n.valor, n.emissor_nome, n.ie_tomador, n.dt_emissao,
      f.nome as fazenda_nome,
      uc.nome as criado_por_nome,
      lf.id as lancamento_id, lf.concluida, lf.concluida_em,
      lf.responsavel_id,
      ul.nome as responsavel_nome
    FROM protocolos p
    JOIN notas n ON n.id = p.nota_id
    LEFT JOIN fazendas f ON f.ie_tomador = n.ie_tomador
    LEFT JOIN usuarios uc ON uc.id = p.criado_por_id
    LEFT JOIN lancamentos_fiscal lf ON lf.protocolo_id = p.id
    LEFT JOIN usuarios ul ON ul.id = lf.responsavel_id
    WHERE 1=1
  `
  const args: any[] = []

  if (mes) {
    sql += ` AND to_char(p.data_recebimento::timestamp, 'YYYY-MM') = ?`
    args.push(mes)
  }

  if (status === 'pendente') {
    sql += ` AND (lf.concluida IS NULL OR lf.concluida = false)`
  } else if (status === 'concluida') {
    sql += ` AND lf.concluida = true`
  }

  sql += ` ORDER BY p.data_recebimento DESC, n.numero`

  const result = await client.execute({ sql, args })
  return NextResponse.json(result.rows)
}
