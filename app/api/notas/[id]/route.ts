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

  if (body.ieTomador !== undefined) {
    const ieTomador = normalizeIE(body.ieTomador || '')
    if (!ieTomador) {
      return NextResponse.json({ error: 'Informe a IE da fazenda' }, { status: 400 })
    }
    const fazenda = await client.execute({ sql: 'SELECT ie_tomador FROM fazendas WHERE ie_tomador = ?', args: [ieTomador] })
    if (!fazenda.rows.length) {
      return NextResponse.json({ error: 'Fazenda (IE) não cadastrada' }, { status: 400 })
    }
    await client.execute({ sql: `UPDATE notas SET ie_tomador = ? WHERE id = ?`, args: [ieTomador, id] })

    const userId = (session.user as any).id
    const userName = session.user?.name || userId
    const notaResult = await client.execute({ sql: 'SELECT numero FROM notas WHERE id = ?', args: [id] })
    const numero = (notaResult.rows[0] as any)?.numero
    await log(userId, userName, 'nota_ie_alterada', `Alterou a IE da NF ${numero} para ${ieTomador}`)

    return NextResponse.json({ success: true })
  }

  const responsavel = (body.responsavelPagamento ?? '').trim() || null

  await client.execute({
    sql: `UPDATE notas SET responsavel_pagamento = ? WHERE id = ?`,
    args: [responsavel, id],
  })

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
