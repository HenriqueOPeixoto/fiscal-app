import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { readFile } from 'fs/promises'
import { authOptions } from '@/lib/auth'
import { client } from '@/lib/db'
import { encontrarPdf, pastaPdfConfigurada } from '@/lib/notaPdf'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (!pastaPdfConfigurada()) {
    return NextResponse.json({ error: 'Pasta de PDFs não configurada' }, { status: 404 })
  }

  const { id } = await params
  const result = await client.execute({ sql: 'SELECT numero, chave FROM notas WHERE id = ?', args: [id] })
  if (!result.rows.length) {
    return NextResponse.json({ error: 'Nota não encontrada' }, { status: 404 })
  }
  const nota = result.rows[0] as any

  const caminho = await encontrarPdf(nota.chave)
  if (!caminho) {
    return NextResponse.json({ error: 'PDF não encontrado para esta nota' }, { status: 404 })
  }

  const conteudo = await readFile(caminho)
  return new Response(new Uint8Array(conteudo), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="NF-${String(nota.numero).replace(/[^\w-]/g, '')}.pdf"`,
    },
  })
}
