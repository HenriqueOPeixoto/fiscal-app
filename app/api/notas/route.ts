import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { client } from '@/lib/db'
import { randomUUID } from 'crypto'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const perfil = (session.user as any).perfil
  if (perfil !== 'compras' && perfil !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })

  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })

  // Find the correct sheet (first sheet or one named like 'Fiscal-io')
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { raw: false })

  const userId = (session.user as any).id
  let importadas = 0
  let ignoradas = 0
  const erros: string[] = []

  for (const row of rows) {
    const numero = String(row['Num'] || '').trim()
    const valor = parseFloat(String(row['Valor'] || '0').replace(',', '.'))
    const emissorNome = String(row['Emissor Nome'] || '').trim()
    const ieTomador = String(row['Tomador IE'] || '').trim()
    const dtEmissaoRaw = row['DtEmi']

    if (!numero || !emissorNome || !ieTomador) {
      ignoradas++
      continue
    }

    // Parse date - XLSX may return serial number or string
    let dtEmissao: string
    if (typeof dtEmissaoRaw === 'number') {
      const date = XLSX.SSF.parse_date_code(dtEmissaoRaw)
      dtEmissao = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
    } else {
      // Format: 2026.06.02 -> 2026-06-02
      dtEmissao = String(dtEmissaoRaw || '').replace(/\./g, '-')
    }

    try {
      await client.execute({
        sql: `INSERT OR IGNORE INTO notas (id, numero, valor, emissor_nome, ie_tomador, dt_emissao, importado_por_id)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [randomUUID(), numero, valor, emissorNome, ieTomador, dtEmissao, userId],
      })
      importadas++
    } catch (e: any) {
      erros.push(`Nota ${numero}: ${e.message}`)
      ignoradas++
    }
  }

  return NextResponse.json({ importadas, ignoradas, erros })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const semProtocolo = searchParams.get('semProtocolo') === 'true'

  let sql = `
    SELECT n.*, f.nome as fazenda_nome, u.nome as importado_por_nome
    FROM notas n
    LEFT JOIN fazendas f ON f.ie_tomador = n.ie_tomador
    LEFT JOIN usuarios u ON u.id = n.importado_por_id
    LEFT JOIN protocolos p ON p.nota_id = n.id
  `
  if (semProtocolo) sql += ` WHERE p.id IS NULL`
  sql += ` ORDER BY n.importado_em DESC`

  const result = await client.execute(sql)
  return NextResponse.json(result.rows)
}
