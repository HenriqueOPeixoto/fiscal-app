import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { client } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const mes = searchParams.get('mes') // YYYY-MM

  let sql = `
    SELECT nc.*, f.nome as fazenda_nome, u.nome as importado_por_nome
    FROM notas_canceladas nc
    LEFT JOIN fazendas f ON f.ie_tomador = nc.ie_tomador
    LEFT JOIN usuarios u ON u.id = nc.importado_por_id
    WHERE 1=1
  `
  const args: any[] = []

  if (mes) {
    sql += ` AND strftime('%Y-%m', nc.dt_emissao) = ?`
    args.push(mes)
  }

  sql += ` ORDER BY nc.dt_emissao DESC, nc.numero`

  const result = await client.execute({ sql, args })
  return NextResponse.json(result.rows)
}
