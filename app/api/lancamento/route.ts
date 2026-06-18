import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { client } from '@/lib/db'
import { log } from '@/lib/logger'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const perfil = (session.user as any).perfil
  if (perfil !== 'fiscal' && perfil !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await req.json()
  const { protocoloId, concluida } = body

  if (!protocoloId) return NextResponse.json({ error: 'protocoloId obrigatório' }, { status: 400 })

  const userId = (session.user as any).id
  const now = new Date().toISOString()

  // Check if lancamento already exists
  const existing = await client.execute({
    sql: `SELECT id, responsavel_id, concluida_em FROM lancamentos_fiscal WHERE protocolo_id = ?`,
    args: [protocoloId],
  })

  if (existing.rows.length) {
    const lancamento = existing.rows[0] as any

    // Only the creator or admin can edit
    if (lancamento.responsavel_id !== userId && perfil !== 'admin') {
      return NextResponse.json(
        { error: 'Você não pode alterar lançamentos de outro usuário' },
        { status: 403 }
      )
    }

    const concluidaEm = concluida ? (lancamento.concluida_em || now) : null

    await client.execute({
      sql: `UPDATE lancamentos_fiscal SET concluida = ?, concluida_em = ?, atualizado_em = ? WHERE id = ?`,
      args: [concluida ? 1 : 0, concluidaEm, now, lancamento.id],
    })

    const userName = session.user?.name || userId
    await log(userId, userName, 'lancamento_atualizado',
      concluida ? `Concluiu lançamento (protocolo ${protocoloId})` : `Desmarcou conclusão (protocolo ${protocoloId})`)
    return NextResponse.json({ id: lancamento.id, updated: true })
  }

  // Create new lancamento
  const id = randomUUID()
  const concluidaEm = concluida ? now : null

  await client.execute({
    sql: `INSERT INTO lancamentos_fiscal
            (id, protocolo_id, concluida, concluida_em, responsavel_id, criado_em, atualizado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, protocoloId, concluida ? 1 : 0, concluidaEm, userId, now, now],
  })

  const userName = session.user?.name || userId
  await log(userId, userName, 'lancamento_atualizado',
    concluida ? `Concluiu lançamento (protocolo ${protocoloId})` : `Registrou lançamento (protocolo ${protocoloId})`)
  return NextResponse.json({ id, created: true })
}
