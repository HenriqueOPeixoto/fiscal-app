import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { client } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const result = await client.execute(`
    SELECT
      n.id, n.numero, n.valor, n.emissor_nome, n.ie_tomador, n.dt_emissao, n.pedidos, n.vencimento,
      n.estorno_justificativa, n.estorno_em, n.estornada_por,
      f.nome as fazenda_nome,
      p.id as protocolo_id, p.data_recebimento,
      lf.id as lancamento_id, lf.concluida, lf.concluida_em,
      ul.nome as responsavel_nome,
      up.nome as protocolado_por_nome
    FROM notas n
    LEFT JOIN fazendas f ON f.ie_tomador = n.ie_tomador
    LEFT JOIN protocolos p ON p.nota_id = n.id
    LEFT JOIN lancamentos_fiscal lf ON lf.protocolo_id = p.id
    LEFT JOIN usuarios ul ON ul.id = lf.responsavel_id
    LEFT JOIN usuarios up ON up.id = p.criado_por_id
    ORDER BY n.importado_em DESC
  `)
  return NextResponse.json(result.rows)
}
