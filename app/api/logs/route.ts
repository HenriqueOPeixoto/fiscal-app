import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { client } from '@/lib/db'

const CATEGORIA_ACOES: Record<string, string[]> = {
  notas:      ['nota_importada', 'nota_cancelada'],
  protocolos: ['protocolo_criado', 'protocolo_estornado', 'lancamento_atualizado'],
  usuarios:   ['usuario_criado', 'usuario_atualizado'],
  fazendas:   ['fazenda_criada', 'fazenda_atualizada', 'fazenda_excluida'],
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).perfil !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const categoria = searchParams.get('categoria') // notas | protocolos | usuarios | fazendas
  const mes = searchParams.get('mes') // YYYY-MM

  let sql = `SELECT * FROM logs WHERE 1=1`
  const args: any[] = []

  if (categoria && CATEGORIA_ACOES[categoria]) {
    const placeholders = CATEGORIA_ACOES[categoria].map(() => '?').join(', ')
    sql += ` AND acao IN (${placeholders})`
    args.push(...CATEGORIA_ACOES[categoria])
  }

  if (mes) {
    sql += ` AND to_char(criado_em::timestamp, 'YYYY-MM') = ?`
    args.push(mes)
  }

  sql += ` ORDER BY criado_em DESC LIMIT 500`

  const result = await client.execute({ sql, args })
  return NextResponse.json(result.rows)
}
