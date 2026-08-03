'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

const STATUS_LABEL: Record<string, string> = {
  'Cancelamento de NF-e homologado': 'Cancelamento',
  'NFS-e de Substituição Gerada': 'Substituição',
}

function formatDateBR(dateStr?: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.slice(0, 10).split('-')
  return y && m && d ? `${d}-${m}-${y}` : dateStr
}

export default function CanceladasPage() {
  const { data: session } = useSession()
  const [notas, setNotas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7))
  const [filtros, setFiltros] = useState({ numero: '', emissor: '', fazenda: '' })
  const [pagina, setPagina] = useState(1)
  const PAGE_SIZE = 25

  useEffect(() => {
    setLoading(true)
    fetch(`/api/canceladas?mes=${filtroMes}`)
      .then(r => r.json())
      .then(data => { setNotas(data); setLoading(false) })
  }, [filtroMes])

  const notasFiltradas = notas.filter(n => {
    if (filtros.numero && !n.numero.toLowerCase().includes(filtros.numero.toLowerCase())) return false
    if (filtros.emissor && !n.emissor_nome.toLowerCase().includes(filtros.emissor.toLowerCase())) return false
    if (filtros.fazenda) {
      const faz = (n.fazenda_nome || n.ie_tomador || '').toLowerCase()
      if (!faz.includes(filtros.fazenda.toLowerCase())) return false
    }
    return true
  })
  const temFiltro = Object.values(filtros).some(v => v !== '')

  const totalPaginas = Math.max(1, Math.ceil(notasFiltradas.length / PAGE_SIZE))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const notasPaginadas = notasFiltradas.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE)

  useEffect(() => {
    setPagina(1)
  }, [filtros.numero, filtros.emissor, filtros.fazenda, filtroMes])

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Notas Canceladas</h1>
        <p className="text-slate-400 text-sm mt-1">
          Notas com status de cancelamento ou substituição identificadas na importação
        </p>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        <input
          type="month"
          value={filtroMes}
          onChange={e => setFiltroMes(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2
                     focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        />
        {filtroMes && (
          <button
            onClick={() => setFiltroMes('')}
            className="text-xs text-slate-500 hover:text-slate-300 underline"
          >
            Todos os períodos
          </button>
        )}
        <span className="ml-auto text-sm text-slate-500">
          {loading ? 'Carregando...' : `${notasFiltradas.length}${temFiltro ? ` de ${notas.length}` : ''} nota(s)`}
        </span>
      </div>
      <div className="flex gap-2 mb-6 flex-wrap items-center">
        {[
          { key: 'numero', placeholder: 'Nº nota', width: 'w-28' },
          { key: 'emissor', placeholder: 'Emissor', width: 'w-48' },
          { key: 'fazenda', placeholder: 'Fazenda', width: 'w-36' },
        ].map(({ key, placeholder, width }) => (
          <input
            key={key}
            type="text"
            value={filtros[key as keyof typeof filtros]}
            onChange={e => setFiltros(prev => ({ ...prev, [key]: e.target.value }))}
            placeholder={placeholder}
            className={`${width} bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2
                        placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30`}
          />
        ))}
        {temFiltro && (
          <button
            onClick={() => setFiltros({ numero: '', emissor: '', fazenda: '' })}
            className="text-xs text-slate-500 hover:text-slate-300 px-2 underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              {['NF', 'Emissor', 'Fazenda', 'Valor', 'Dt. Emissão', 'Status', 'Importado em'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {!loading && notasFiltradas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500 text-sm">
                  {notas.length === 0 ? 'Nenhuma nota cancelada neste período' : 'Nenhuma nota corresponde aos filtros'}
                </td>
              </tr>
            )}
            {notasPaginadas.map((n: any) => (
              <tr key={n.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3 text-sm text-white font-medium">{n.numero}</td>
                <td className="px-4 py-3 text-xs text-slate-400 max-w-[160px] truncate" title={n.emissor_nome}>
                  {n.emissor_nome}
                </td>
                <td className="px-4 py-3 text-xs text-slate-300">{n.fazenda_nome || n.ie_tomador}</td>
                <td className="px-4 py-3 text-sm text-white">
                  {Number(n.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{formatDateBR(n.dt_emissao)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    n.status === 'Cancelamento de NF-e homologado'
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {STATUS_LABEL[n.status] ?? n.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{formatDateBR(n.importado_em)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && notasFiltradas.length > PAGE_SIZE && (
          <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Página {paginaAtual} de {totalPaginas}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPagina(p => Math.max(1, p - 1))}
                disabled={paginaAtual === 1}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700
                           hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-all"
              >
                Anterior
              </button>
              <button
                onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                disabled={paginaAtual === totalPaginas}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700
                           hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-all"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
