import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { client } from '@/lib/db'
import { log } from '@/lib/logger'

async function checkAdmin(session: any) {
  return session && (session.user as any).perfil === 'admin'
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!await checkAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const { nome, ieTomador } = await req.json()
  if (!nome?.trim() || !ieTomador?.trim()) {
    return NextResponse.json({ error: 'Nome e IE são obrigatórios' }, { status: 400 })
  }

  try {
    await client.execute({
      sql: 'UPDATE fazendas SET nome = ?, ie_tomador = ? WHERE id = ?',
      args: [nome.trim(), ieTomador.trim(), id],
    })
    const adminName = session!.user?.name || (session!.user as any).id
    await log((session!.user as any).id, adminName, 'fazenda_atualizada',
      `Editou fazenda "${nome.trim()}" (IE: ${ieTomador.trim()})`)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Já existe uma fazenda com essa IE' }, { status: 409 })
    }
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!await checkAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const fazenda = await client.execute({ sql: 'SELECT nome, ie_tomador FROM fazendas WHERE id = ?', args: [id] })
  await client.execute({ sql: 'DELETE FROM fazendas WHERE id = ?', args: [id] })
  const f = (fazenda.rows[0] as any) || {}
  const adminName = session!.user?.name || (session!.user as any).id
  await log((session!.user as any).id, adminName, 'fazenda_excluida',
    `Excluiu fazenda "${f.nome}" (IE: ${f.ie_tomador})`)
  return NextResponse.json({ ok: true })
}
