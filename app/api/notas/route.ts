import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { client } from '@/lib/db'
import { log } from '@/lib/logger'
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
  const ignoradasLista: { numero: string; emissor: string; motivo: string }[] = []

  // Debug: collect column names and unique status values seen
  const colunas = rows.length > 0 ? Object.keys(rows[0]) : []
  const statusVistos = new Set<string>()

  const COLUNAS_OBRIGATORIAS = ['Num', 'Valor', 'Emissor Nome', 'Emissor CNPJ/CPF', 'Tomador IE', 'DtEmi', 'Status', 'Chave']
  const colunasFaltando = COLUNAS_OBRIGATORIAS.filter(c => !colunas.includes(c))
  if (colunasFaltando.length > 0) {
    return NextResponse.json({
      error: `Arquivo não importado: coluna(s) obrigatória(s) não encontrada(s): ${colunasFaltando.join(', ')}`,
      debug: { colunas, statusVistos: [] },
    }, { status: 400 })
  }

  const normalizeIE = (ie: string) => String(ie).replace(/\D/g, '').replace(/^0+/, '')
  const normalizeNumero = (n: string) => String(n).trim().replace(/^0+(?=\d)/, '')

  // Load registered IEs once before the loop, normalized for comparison
  const fazendasResult = await client.execute('SELECT ie_tomador FROM fazendas')
  const iesCadastradas = new Set((fazendasResult.rows as any[]).map(r => normalizeIE(r.ie_tomador)))

  // Chave (chave de acesso da NF-e) is the reliable way to detect a note already in the system
  const [notasChaves, canceladasChaves] = await Promise.all([
    client.execute(`SELECT chave FROM notas WHERE chave != ''`),
    client.execute(`SELECT chave FROM notas_canceladas WHERE chave != ''`),
  ])
  const chavesExistentes = new Set([
    ...(notasChaves.rows as any[]).map(r => r.chave),
    ...(canceladasChaves.rows as any[]).map(r => r.chave),
  ])

  for (const row of rows) {
    const numero = normalizeNumero(row['Num'] || '')
    const valor = parseFloat(String(row['Valor'] || '0').replace(',', '.'))
    const emissorNome = String(row['Emissor Nome'] || '').trim()
    const cnpjEmissor = String(row['Emissor CNPJ/CPF'] || '').replace(/\D/g, '')
    const ieTomador = normalizeIE(row['Tomador IE'] || '')
    const chave = String(row['Chave'] || '').replace(/\D/g, '')
    const dtEmissaoRaw = row['DtEmi']
    const rawStatus1 = String(row['Status_1'] || '').trim()
    const rawStatus = String(row['Status'] || '').trim()
    statusVistos.add(rawStatus1 || rawStatus || '(vazio)')

    if (!numero || !emissorNome || !chave) {
      ignoradas++
      ignoradasLista.push({ numero: numero || '(sem número)', emissor: emissorNome || '(sem emissor)', motivo: 'Dados inválidos' })
      continue
    }

    // Notas fiscais de serviço (NFS-e) não possuem Tomador IE — só validamos a fazenda quando a nota informa uma IE
    if (ieTomador && !iesCadastradas.has(ieTomador)) {
      ignoradas++
      ignoradasLista.push({ numero, emissor: emissorNome, motivo: 'Fazenda não cadastrada' })
      continue
    }

    if (chavesExistentes.has(chave)) {
      ignoradas++
      ignoradasLista.push({ numero, emissor: emissorNome, motivo: 'Já existia' })
      continue
    }

    // Parse date - XLSX may return serial number or string
    let dtEmissao: string
    if (typeof dtEmissaoRaw === 'number') {
      const date = XLSX.SSF.parse_date_code(dtEmissaoRaw)
      dtEmissao = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
    } else {
      dtEmissao = String(dtEmissaoRaw || '').replace(/\./g, '-')
    }

    try {
      const r = await client.execute({
        sql: `INSERT OR IGNORE INTO notas (id, numero, valor, emissor_nome, cnpj_emissor, chave, ie_tomador, dt_emissao, importado_por_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [randomUUID(), numero, valor, emissorNome, cnpjEmissor, chave, ieTomador, dtEmissao, userId],
      })
      if (r.rowsAffected > 0) { importadas++; chavesExistentes.add(chave) }
      else { ignoradas++; ignoradasLista.push({ numero, emissor: emissorNome, motivo: 'Já existia' }) }
    } catch (e: any) {
      erros.push(`Nota ${numero}: ${e.message}`)
      ignoradas++
    }
  }

  const userName = session.user?.name || userId
  await log(userId, userName, 'nota_importada',
    `Importou ${importadas} nota(s), ${ignoradas} ignorada(s)`)

  return NextResponse.json({ importadas, ignoradas, ignoradasLista, erros, debug: { colunas, statusVistos: [...statusVistos] } })
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
