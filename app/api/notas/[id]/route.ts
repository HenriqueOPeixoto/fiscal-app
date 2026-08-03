import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { client } from '@/lib/db'
import { log } from '@/lib/logger'

const normalizeIE = (ie: string) => String(ie).replace(/\D/g, '').replace(/^0+/, '')

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const perfil = (session.user as any).perfil
  if (perfil !== 'compras' && perfil !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()

  const notaAtual = await client.execute({
    sql: 'SELECT numero, ie_tomador, responsavel_pagamento, forma_pagamento, pedidos, vencimento FROM notas WHERE id = ?',
    args: [id],
  })
  if (!notaAtual.rows.length) {
    return NextResponse.json({ error: 'Nota não encontrada' }, { status: 404 })
  }
  const atual = notaAtual.rows[0] as any

  const updates: string[] = []
  const args: any[] = []
  const mudancas: string[] = []

  const registrar = (coluna: string, label: string, valorNovo: string | null, valorAtual: string | null) => {
    if (valorNovo === (valorAtual ?? null)) return
    updates.push(`${coluna} = ?`)
    args.push(valorNovo)
    mudancas.push(`${label}: "${valorAtual || '—'}" → "${valorNovo || '—'}"`)
  }

  // IE em branco significa "não alterar" — notas de serviço (NFS-e) legitimamente ficam sem IE
  if (body.ieTomador !== undefined && body.ieTomador !== '') {
    const ieTomador = normalizeIE(body.ieTomador)
    if (!ieTomador) {
      return NextResponse.json({ error: 'Informe a IE da fazenda' }, { status: 400 })
    }
    const fazenda = await client.execute({ sql: 'SELECT ie_tomador FROM fazendas WHERE ie_tomador = ?', args: [ieTomador] })
    if (!fazenda.rows.length) {
      return NextResponse.json({ error: 'Fazenda (IE) não cadastrada' }, { status: 400 })
    }
    registrar('ie_tomador', 'IE', ieTomador, atual.ie_tomador)
  }
  if (body.responsavelPagamento !== undefined) {
    registrar('responsavel_pagamento', 'Responsável Pagamento', (body.responsavelPagamento ?? '').trim() || null, atual.responsavel_pagamento)
  }
  if (body.formaPagamento !== undefined) {
    registrar('forma_pagamento', 'Forma de Pagamento', (body.formaPagamento ?? '').trim() || null, atual.forma_pagamento)
  }
  if (body.pedidos !== undefined) {
    registrar('pedidos', 'Pedidos', (body.pedidos ?? '').trim() || null, atual.pedidos)
  }
  if (body.vencimento !== undefined) {
    registrar('vencimento', 'Vencimento', body.vencimento || null, atual.vencimento)
  }

  if (!updates.length) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
  }

  args.push(id)
  await client.execute({ sql: `UPDATE notas SET ${updates.join(', ')} WHERE id = ?`, args })

  const userId = (session.user as any).id
  const userName = session.user?.name || userId
  await log(userId, userName, 'nota_atualizada', `Atualizou NF ${atual.numero} — ${mudancas.join('; ')}`)

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const perfil = (session.user as any).perfil
  if (perfil !== 'compras' && perfil !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id } = await params
  const notaResult = await client.execute({ sql: 'SELECT * FROM notas WHERE id = ?', args: [id] })
  if (notaResult.rows.length === 0) {
    return NextResponse.json({ error: 'Nota não encontrada' }, { status: 404 })
  }
  const nota = notaResult.rows[0] as any

  // Cascade delete: lancamentos -> protocolos -> nota
  await client.execute({
    sql: `DELETE FROM lancamentos_fiscal WHERE protocolo_id IN (SELECT id FROM protocolos WHERE nota_id = ?)`,
    args: [id],
  })
  await client.execute({ sql: `DELETE FROM protocolos WHERE nota_id = ?`, args: [id] })
  await client.execute({ sql: `DELETE FROM notas WHERE id = ?`, args: [id] })

  const userId = (session.user as any).id
  const userName = session.user?.name || userId
  await log(userId, userName, 'nota_excluida',
    `Excluiu NF ${nota.numero} — ${nota.emissor_nome}`)

  return NextResponse.json({ ok: true })
}
