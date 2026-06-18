import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { client } from '@/lib/db'
import { log } from '@/lib/logger'
import { randomUUID } from 'crypto'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const result = await client.execute('SELECT * FROM fazendas ORDER BY nome')
  return NextResponse.json(result.rows)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if ((session.user as any).perfil !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { nome, ieTomador } = await req.json()
  if (!nome?.trim() || !ieTomador?.trim()) {
    return NextResponse.json({ error: 'Nome e IE são obrigatórios' }, { status: 400 })
  }

  try {
    await client.execute({
      sql: 'INSERT INTO fazendas (id, nome, ie_tomador) VALUES (?, ?, ?)',
      args: [randomUUID(), nome.trim(), ieTomador.trim()],
    })
    const adminName = session.user?.name || (session.user as any).id
    await log((session.user as any).id, adminName, 'fazenda_criada',
      `Cadastrou fazenda "${nome.trim()}" (IE: ${ieTomador.trim()})`)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Já existe uma fazenda com essa IE' }, { status: 409 })
    }
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
