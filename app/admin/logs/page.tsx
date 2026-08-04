'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

const ACAO_LABEL: Record<string, string> = {
  nota_importada:      'Importação',
  nota_importada_xml:  'Importação automática (XML)',
  nota_xml_erro:       'Erro na importação de XML',
  nota_cancelada:      'Nota cancelada',
  protocolo_criado:    'Protocolo criado',
  protocolo_estornado: 'Estorno',
  lancamento_atualizado: 'Lançamento',
  usuario_criado:      'Usuário criado',
  usuario_atualizado:  'Usuário editado',
  fazenda_criada:      'Fazenda criada',
  fazenda_atualizada:  'Fazenda editada',
  fazenda_excluida:    'Fazenda excluída',
}

function formatDateTimeBR(str?: string): string {
  if (!str) return ''
  const [datePart, timePart] = str.replace('T', ' ').split(' ')
  const [y, m, d] = (datePart || '').split('-')
  if (!y || !m || !d) return str
  return timePart ? `${d}-${m}-${y} ${timePart.slice(0, 5)}` : `${d}-${m}-${y}`
}

const ACAO_COR: Record<string, string> = {
  nota_importada:      'bg-emerald-500/10 text-emerald-400',
  nota_importada_xml:  'bg-emerald-500/10 text-emerald-300',
  nota_xml_erro:       'bg-amber-500/10 text-amber-400',
  nota_cancelada:      'bg-red-500/10 text-red-400',
  protocolo_criado:    'bg-blue-500/10 text-blue-400',
  protocolo_estornado: 'bg-orange-500/10 text-orange-400',
  lancamento_atualizado: 'bg-purple-500/10 text-purple-400',
  usuario_criado:      'bg-slate-500/10 text-slate-300',
  usuario_atualizado:  'bg-slate-500/10 text-slate-400',
  fazenda_criada:      'bg-teal-500/10 text-teal-400',
  fazenda_atualizada:  'bg-teal-500/10 text-teal-300',
  fazenda_excluida:    'bg-red-500/10 text-red-300',
}

export default function LogsPage() {
  const { data: session } = useSession()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [categoria, setCategoria] = useState('')
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))

  const perfil = (session?.user as any)?.perfil

  useEffect(() => {
    if (perfil !== 'admin') return
    setLoading(true)
    const params = new URLSearchParams()
    if (categoria) params.set('categoria', categoria)
    if (mes) params.set('mes', mes)
    fetch(`/api/logs?${params}`)
      .then(r => r.json())
      .then(data => { setLogs(data); setLoading(false) })
  }, [perfil, categoria, mes])

  if (perfil !== 'admin') {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-5 text-sm">
          Acesso exclusivo para administradores.
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Logs do Sistema</h1>
        <p className="text-slate-400 text-sm mt-1">Registro de todas as ações realizadas no sistema</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <input
          type="month"
          value={mes}
          onChange={e => setMes(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2
                     focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        />
        <select
          value={categoria}
          onChange={e => setCategoria(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2
                     focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <option value="">Todas as categorias</option>
          <option value="notas">Notas</option>
          <option value="protocolos">Protocolos</option>
          <option value="usuarios">Usuários</option>
          <option value="fazendas">Fazendas</option>
        </select>
        <span className="ml-auto text-sm text-slate-500">
          {loading ? 'Carregando...' : `${logs.length} registro(s)`}
        </span>
      </div>

      {/* Tabela */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              {['Data / Hora', 'Usuário', 'Ação', 'Descrição'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500 text-sm">
                  Nenhum registro encontrado
                </td>
              </tr>
            )}
            {logs.map((l: any) => (
              <tr key={l.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap font-mono">
                  {formatDateTimeBR(l.criado_em)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">
                  {l.usuario_nome}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${ACAO_COR[l.acao] ?? 'bg-slate-700 text-slate-400'}`}>
                    {ACAO_LABEL[l.acao] ?? l.acao}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 max-w-md">
                  {l.descricao}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
