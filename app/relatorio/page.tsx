'use client'

import { useEffect, useState } from 'react'

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function primeiroDiaMesAtual(): string {
  const d = new Date()
  return formatDate(new Date(d.getFullYear(), d.getMonth(), 1))
}
function ultimoDiaMesAtual(): string {
  const d = new Date()
  return formatDate(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}
function formatDateBR(dateStr?: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.slice(0, 10).split('-')
  return y && m && d ? `${d}-${m}-${y}` : dateStr
}

function getStatus(n: any) {
  if (!n.protocolo_id) {
    if (n.estorno_justificativa) return { label: 'Estornada', cor: 'bg-red-500/10 text-red-400' }
    return { label: 'Pendente de Protocolo', cor: 'bg-amber-500/10 text-amber-400' }
  }
  if (!n.concluida) return { label: 'Pendente de Lançamento', cor: 'bg-blue-500/10 text-blue-400' }
  return { label: 'Concluída', cor: 'bg-emerald-500/10 text-emerald-400' }
}

export default function RelatorioPage() {
  const [notas, setNotas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState({
    numero: '', emissor: '', fazenda: '',
    dtEmissaoInicio: primeiroDiaMesAtual(), dtEmissaoFim: ultimoDiaMesAtual(),
  })
  const [somenteEstornadas, setSomenteEstornadas] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: '', direction: 'asc' })
  const [pagina, setPagina] = useState(1)
  const PAGE_SIZE = 25
  const [verJustificativa, setVerJustificativa] = useState<any>(null)

  useEffect(() => {
    fetch('/api/relatorio').then(r => r.json()).then(data => { setNotas(data); setLoading(false) })
  }, [])

  const notasFiltradas = notas.filter(n => {
    if (filtros.numero && !n.numero.toLowerCase().includes(filtros.numero.toLowerCase())) return false
    if (filtros.emissor && !n.emissor_nome.toLowerCase().includes(filtros.emissor.toLowerCase())) return false
    if (filtros.fazenda) {
      const faz = (n.fazenda_nome || n.ie_tomador || '').toLowerCase()
      if (!faz.includes(filtros.fazenda.toLowerCase())) return false
    }
    const dtEmissao = n.dt_emissao?.slice(0, 10) || ''
    if (filtros.dtEmissaoInicio && dtEmissao < filtros.dtEmissaoInicio) return false
    if (filtros.dtEmissaoFim && dtEmissao > filtros.dtEmissaoFim) return false
    if (somenteEstornadas && !n.estorno_justificativa) return false
    return true
  })
  const temFiltro = somenteEstornadas || Object.values(filtros).some(v => v !== '')

  function getSortValue(n: any, key: string) {
    switch (key) {
      case 'numero': return n.numero || ''
      case 'emissor_nome': return n.emissor_nome || ''
      case 'fazenda': return n.fazenda_nome || n.ie_tomador || ''
      case 'valor': return Number(n.valor) || 0
      case 'dt_emissao': return n.dt_emissao || ''
      case 'pedidos': return n.pedidos || ''
      case 'status': return getStatus(n).label
      default: return ''
    }
  }

  const notasOrdenadas = sortConfig.key
    ? [...notasFiltradas].sort((a, b) => {
        const av = getSortValue(a, sortConfig.key)
        const bv = getSortValue(b, sortConfig.key)
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), 'pt-BR')
        return sortConfig.direction === 'asc' ? cmp : -cmp
      })
    : notasFiltradas

  const totalPaginas = Math.max(1, Math.ceil(notasOrdenadas.length / PAGE_SIZE))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const notasPaginadas = notasOrdenadas.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE)

  useEffect(() => {
    setPagina(1)
  }, [filtros.numero, filtros.emissor, filtros.fazenda, filtros.dtEmissaoInicio, filtros.dtEmissaoFim, somenteEstornadas, sortConfig.key, sortConfig.direction])

  function handleSort(key: string) {
    setSortConfig(prev => prev.key === key
      ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: 'asc' })
  }

  function SortIcon({ column }: { column: string }) {
    if (sortConfig.key !== column) return <span className="text-slate-600">⇕</span>
    return <span className="text-emerald-400">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Relatório</h1>
        <p className="text-slate-400 text-sm mt-1">Status de cada nota no sistema — protocolo e lançamento fiscal</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap items-end">
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
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={filtros.dtEmissaoInicio}
            onChange={e => setFiltros(prev => ({ ...prev, dtEmissaoInicio: e.target.value }))}
            className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            title="Data de Emissão (início)"
          />
          <span className="text-slate-600 text-xs">até</span>
          <input
            type="date"
            value={filtros.dtEmissaoFim}
            onChange={e => setFiltros(prev => ({ ...prev, dtEmissaoFim: e.target.value }))}
            className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            title="Data de Emissão (fim)"
          />
        </div>
        <button
          onClick={() => setSomenteEstornadas(prev => !prev)}
          className={`px-3 py-2 text-sm rounded-lg border transition-all ${
            somenteEstornadas
              ? 'bg-red-500/10 border-red-500/30 text-red-400 font-medium'
              : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
          }`}
        >
          Somente estornadas
        </button>
        {temFiltro && (
          <button
            onClick={() => { setFiltros({ numero: '', emissor: '', fazenda: '', dtEmissaoInicio: '', dtEmissaoFim: '' }); setSomenteEstornadas(false) }}
            className="text-xs text-slate-500 hover:text-slate-300 px-2 underline"
          >
            Limpar filtros
          </button>
        )}
        <span className="text-sm text-slate-500 ml-auto">
          {loading ? 'Carregando...' : `${notasFiltradas.length} de ${notas.length} nota(s)`}
        </span>
      </div>

      {/* Tabela */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              {[
                { label: 'NF', key: 'numero' },
                { label: 'Emissor', key: 'emissor_nome' },
                { label: 'Fazenda', key: 'fazenda' },
                { label: 'Valor', key: 'valor' },
                { label: 'Emissão', key: 'dt_emissao' },
                { label: 'Status', key: 'status' },
                { label: 'Data Protocolo', key: null },
                { label: 'Pedido', key: 'pedidos' },
                { label: 'Responsável Lanç.', key: null },
                { label: 'Concluída em', key: null },
                { label: '', key: null },
              ].map(({ label, key }) => (
                <th key={label} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {key ? (
                    <button onClick={() => handleSort(key)} className="flex items-center gap-1 hover:text-slate-300">
                      {label} <SortIcon column={key} />
                    </button>
                  ) : label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {!loading && notasFiltradas.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-slate-500 text-sm">
                  {notas.length === 0 ? 'Nenhuma nota encontrada' : 'Nenhuma nota corresponde aos filtros'}
                </td>
              </tr>
            )}
            {notasPaginadas.map((n: any) => {
              const status = getStatus(n)
              return (
                <tr key={n.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 text-sm text-white font-medium">{n.numero}</td>
                  <td className="px-4 py-3 text-xs text-slate-400 max-w-[160px] truncate" title={n.emissor_nome}>{n.emissor_nome}</td>
                  <td className="px-4 py-3 text-xs text-slate-300">{n.fazenda_nome || n.ie_tomador || '—'}</td>
                  <td className="px-4 py-3 text-sm text-white">
                    {Number(n.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{formatDateBR(n.dt_emissao)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${status.cor}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{formatDateBR(n.data_recebimento) || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-300">{n.pedidos || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-300">{n.responsavel_nome || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{formatDateBR(n.concluida_em) || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {status.label === 'Estornada' && (
                      <button
                        onClick={() => setVerJustificativa(n)}
                        className="text-xs text-red-400 hover:text-red-300 border border-red-900/50
                                   hover:border-red-700 px-2.5 py-1 rounded transition-all whitespace-nowrap"
                      >
                        Ver justificativa
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {!loading && notasOrdenadas.length > PAGE_SIZE && (
          <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500">Página {paginaAtual} de {totalPaginas}</span>
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

      {/* Modal: justificativa do estorno */}
      {verJustificativa && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-white font-semibold text-base mb-1">Justificativa do estorno</h3>
            <p className="text-slate-400 text-sm mb-4">
              NF <span className="text-white font-medium">{verJustificativa.numero}</span> —{' '}
              {verJustificativa.emissor_nome}
            </p>
            <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 mb-4">
              <p className="text-sm text-slate-300">{verJustificativa.estorno_justificativa}</p>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              Estornada por <span className="text-slate-300">{verJustificativa.estornada_por}</span> em{' '}
              {formatDateBR(verJustificativa.estorno_em)}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setVerJustificativa(null)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
