import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { client } from '@/lib/db'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const perfil = (session.user as any).perfil
  if (perfil !== 'fiscal' && perfil !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const justificativa = (body.justificativa || '').trim()
  if (!justificativa) {
    return NextResponse.json({ error: 'Justificativa obrigatória' }, { status: 400 })
  }

  const { id } = await params
  const userId = (session.user as any).id
  const userName = (session.user as any).name || (session.user as any).nome || userId
  const now = new Date().toISOString()

  // Fetch protocolo to get nota_id
  const protocolo = await client.execute({
    sql: `SELECT id, nota_id FROM protocolos WHERE id = ?`,
    args: [id],
  })
  if (!protocolo.rows.length) {
    return NextResponse.json({ error: 'Protocolo não encontrado' }, { status: 404 })
  }
  const notaId = (protocolo.rows[0] as any).nota_id

  // If a lançamento exists, only its owner or admin can estornar
  const lancamento = await client.execute({
    sql: `SELECT id, responsavel_id FROM lancamentos_fiscal WHERE protocolo_id = ?`,
    args: [id],
  })
  if (lancamento.rows.length) {
    const row = lancamento.rows[0] as any
    if (row.responsavel_id !== userId && perfil !== 'admin') {
      return NextResponse.json({ error: 'Você não pode estornar lançamentos de outro usuário' }, { status: 403 })
    }
    await client.execute({
      sql: `DELETE FROM lancamentos_fiscal WHERE protocolo_id = ?`,
      args: [id],
    })
  }

  await client.execute({
    sql: `DELETE FROM protocolos WHERE id = ?`,
    args: [id],
  })

  // Save justification on the nota so compras can see it
  await client.execute({
    sql: `UPDATE notas SET estorno_justificativa = ?, estorno_em = ?, estornada_por = ? WHERE id = ?`,
    args: [justificativa, now, userName, notaId],
  })

  return NextResponse.json({ success: true })
}
