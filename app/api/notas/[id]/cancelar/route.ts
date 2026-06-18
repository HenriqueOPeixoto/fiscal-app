import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { client } from '@/lib/db'
import { log } from '@/lib/logger'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const perfil = (session.user as any).perfil
  if (perfil !== 'compras' && perfil !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id } = await params
  const { status } = await req.json()
  if (!status) return NextResponse.json({ error: 'Status obrigatório' }, { status: 400 })

  const notaResult = await client.execute({ sql: 'SELECT * FROM notas WHERE id = ?', args: [id] })
  if (notaResult.rows.length === 0) {
    return NextResponse.json({ error: 'Nota não encontrada' }, { status: 404 })
  }
  const nota = notaResult.rows[0] as any

  await client.execute({
    sql: `INSERT OR IGNORE INTO notas_canceladas
          (id, numero, valor, emissor_nome, cnpj_emissor, ie_tomador, dt_emissao, status, importado_por_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [randomUUID(), nota.numero, nota.valor, nota.emissor_nome, nota.cnpj_emissor,
           nota.ie_tomador, nota.dt_emissao, status, nota.importado_por_id],
  })

  // Cascade delete: lancamentos -> protocolos -> nota
  await client.execute({
    sql: `DELETE FROM lancamentos_fiscal WHERE protocolo_id IN (SELECT id FROM protocolos WHERE nota_id = ?)`,
    args: [id],
  })
  await client.execute({ sql: `DELETE FROM protocolos WHERE nota_id = ?`, args: [id] })
  await client.execute({ sql: `DELETE FROM notas WHERE id = ?`, args: [id] })

  const userName = session.user?.name || (session.user as any).id
  await log(userId, userName, 'nota_cancelada',
    `Cancelou NF ${nota.numero} — ${nota.emissor_nome} (motivo: ${status})`)

  return NextResponse.json({ ok: true })
}
