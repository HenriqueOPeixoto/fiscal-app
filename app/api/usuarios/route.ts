import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { client } from '@/lib/db'
import { log } from '@/lib/logger'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).perfil !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const result = await client.execute(
    `SELECT id, nome, email, perfil, ativo, criado_em FROM usuarios ORDER BY nome`
  )
  return NextResponse.json(result.rows)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).perfil !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { nome, email, senha, perfil } = await req.json()

  if (!nome || !email || !senha || !perfil) {
    return NextResponse.json({ error: 'Dados obrigatórios faltando' }, { status: 400 })
  }

  if (!['compras', 'fiscal', 'admin'].includes(perfil)) {
    return NextResponse.json({ error: 'Perfil inválido' }, { status: 400 })
  }

  const senhaHash = await bcrypt.hash(senha, 10)
  const id = randomUUID()

  try {
    await client.execute({
      sql: `INSERT INTO usuarios (id, nome, email, senha, perfil) VALUES (?, ?, ?, ?, ?)`,
      args: [id, nome, email, senhaHash, perfil],
    })
    const adminName = session.user?.name || (session.user as any).id
    await log((session.user as any).id, adminName, 'usuario_criado',
      `Criou usuário ${nome} (${email}), perfil: ${perfil}`)
    return NextResponse.json({ id, success: true })
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 })
    }
    throw e
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).perfil !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id, ativo, perfil, senha } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  const updates: string[] = []
  const args: any[] = []

  if (ativo !== undefined) { updates.push('ativo = ?'); args.push(ativo ? 1 : 0) }
  if (perfil) { updates.push('perfil = ?'); args.push(perfil) }
  if (senha) {
    const hash = await bcrypt.hash(senha, 10)
    updates.push('senha = ?'); args.push(hash)
  }

  if (!updates.length) return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })

  args.push(id)
  await client.execute({ sql: `UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`, args })

  const adminName = session.user?.name || (session.user as any).id
  const desc = [
    ativo !== undefined ? `ativo: ${ativo}` : null,
    perfil ? `perfil: ${perfil}` : null,
    senha ? 'senha alterada' : null,
  ].filter(Boolean).join(', ')
  await log((session.user as any).id, adminName, 'usuario_atualizado',
    `Atualizou usuário #${id} (${desc})`)

  return NextResponse.json({ success: true })
}
