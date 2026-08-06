'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function formatDateBR(dateStr?: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.slice(0, 10).split('-')
  return y && m && d ? `${d}-${m}-${y}` : dateStr
}
function primeiroDiaMesAtual(): string {
  const d = new Date()
  return formatDate(new Date(d.getFullYear(), d.getMonth(), 1))
}
function ultimoDiaMesAtual(): string {
  const d = new Date()
  return formatDate(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

export default function FiscalPage() {
  const { data: session } = useSession()
  const [protocolos, setProtocolos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'pendente' | 'concluida'>('pendente')
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7))
  const [filtros, setFiltros] = useState({
    numero: '', emissor: '', fazenda: '',
    dtEmissaoInicio: primeiroDiaMesAtual(), dtEmissaoFim: ultimoDiaMesAtual(),
    vencimentoInicio: '', vencimentoFim: '',
  })
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: '', direction: 'asc' })
  const [concluindo, setConcluindo] = useState<string | null>(null)
  const [estornando, setEstornando] = useState<string | null>(null)
  const [justificativa, setJustificativa] = useState('')
  const [enviandoEstorno, setEnviandoEstorno] = useState(false)
  const [pagina, setPagina] = useState(1)
  const PAGE_SIZE = 25

  const perfil = (session?.user as any)?.perfil
  const userId = (session?.user as any)?.id

  async function carregar() {
    setLoading(true)
    const params = new URLSearchParams({ mes: filtroMes, status: filtroStatus })
    const data = await fetch(`/api/protocolo?${params}`).then(r => r.json())
    setProtocolos(data)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [filtroMes, filtroStatus])

  async function concluir(protocoloId: string) {
    setConcluindo(protocoloId)
    await fetch('/api/lancamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocoloId, concluida: true }),
    })
    setConcluindo(null)
    carregar()
  }

  function abrirEstorno(protocoloId: string) {
    setEstornando(protocoloId)
    setJustificativa('')
  }

  async function confirmarEstorno() {
    if (!estornando || !justificativa.trim()) return
    setEnviandoEstorno(true)
    await fetch(`/api/protocolo/${estornando}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ justificativa: justificativa.trim() }),
    })
    setEstornando(null)
    setJustificativa('')
    setEnviandoEstorno(false)
    carregar()
  }

  const protocolosFiltrados = protocolos.filter(p => {
    if (filtros.numero && !p.numero.toLowerCase().includes(filtros.numero.toLowerCase())) return false
    if (filtros.emissor && !p.emissor_nome.toLowerCase().includes(filtros.emissor.toLowerCase())) return false
    if (filtros.fazenda) {
      const faz = (p.fazenda_nome || p.ie_tomador || '').toLowerCase()
      if (!faz.includes(filtros.fazenda.toLowerCase())) return false
    }
    const dtEmissao = p.dt_emissao?.slice(0, 10) || ''
    if (filtros.dtEmissaoInicio && dtEmissao < filtros.dtEmissaoInicio) return false
    if (filtros.dtEmissaoFim && dtEmissao > filtros.dtEmissaoFim) return false
    const vencimento = p.vencimento?.slice(0, 10) || ''
    if (filtros.vencimentoInicio && (!vencimento || vencimento < filtros.vencimentoInicio)) return false
    if (filtros.vencimentoFim && (!vencimento || vencimento > filtros.vencimentoFim)) return false
    return true
  })
  const temFiltro = Object.values(filtros).some(v => v !== '')

  function getSortValue(p: any, key: string) {
    switch (key) {
      case 'numero': return p.numero || ''
      case 'emissor_nome': return p.emissor_nome || ''
      case 'fazenda': return p.fazenda_nome || p.ie_tomador || ''
      case 'valor': return Number(p.valor) || 0
      case 'dt_emissao': return p.dt_emissao || ''
      case 'data_recebimento': return p.data_recebimento || ''
      case 'vencimento': return p.vencimento || ''
      default: return ''
    }
  }

  const protocolosOrdenados = sortConfig.key
    ? [...protocolosFiltrados].sort((a, b) => {
        const av = getSortValue(a, sortConfig.key)
        const bv = getSortValue(b, sortConfig.key)
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), 'pt-BR')
        return sortConfig.direction === 'asc' ? cmp : -cmp
      })
    : protocolosFiltrados

  const totalPaginas = Math.max(1, Math.ceil(protocolosOrdenados.length / PAGE_SIZE))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const protocolosPaginados = protocolosOrdenados.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE)

  useEffect(() => {
    setPagina(1)
  }, [filtros.numero, filtros.emissor, filtros.fazenda, filtros.dtEmissaoInicio, filtros.dtEmissaoFim, filtros.vencimentoInicio, filtros.vencimentoFim, sortConfig.key, sortConfig.direction, filtroMes, filtroStatus])

  function handleSort(key: string) {
    setSortConfig(prev => prev.key === key
      ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: 'asc' })
  }

  function SortIcon({ column }: { column: string }) {
    if (sortConfig.key !== column) return <span className="text-slate-600">⇕</span>
    return <span className="text-emerald-400">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
  }

  const canAct = (p: any) => {
    if (perfil === 'admin') return true
    if (perfil !== 'fiscal') return false
    return !p.responsavel_id || p.responsavel_id === userId
  }

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Lançamentos Fiscais</h1>
        <p className="text-slate-400 text-sm mt-1">Gerencie as notas protocoladas pelo departamento de compras</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-3 flex-wrap items-center">
        <input
          type="month"
          value={filtroMes}
          onChange={e => setFiltroMes(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2
                     focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        />
        {(['todas', 'pendente', 'concluida'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className={`px-4 py-2 text-sm rounded-lg border transition-all ${
              filtroStatus === s
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-medium'
                : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
            }`}
          >
            {{ todas: 'Todas', pendente: 'Pendentes', concluida: 'Concluídas' }[s]}
          </button>
        ))}
        <span className="ml-auto text-sm text-slate-500 flex items-center">
          {loading ? 'Carregando...' : `${protocolosFiltrados.length}${temFiltro ? ` de ${protocolos.length}` : ''} nota(s)`}
        </span>
      </div>
      <div className="flex gap-2 mb-6 flex-wrap items-end">
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
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Data de Emissão</label>
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
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Vencimento</label>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={filtros.vencimentoInicio}
              onChange={e => setFiltros(prev => ({ ...prev, vencimentoInicio: e.target.value }))}
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2
                         focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              title="Vencimento (início)"
            />
            <span className="text-slate-600 text-xs">até</span>
            <input
              type="date"
              value={filtros.vencimentoFim}
              onChange={e => setFiltros(prev => ({ ...prev, vencimentoFim: e.target.value }))}
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2
                         focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              title="Vencimento (fim)"
            />
          </div>
        </div>
        {temFiltro && (
          <button
            onClick={() => setFiltros({ numero: '', emissor: '', fazenda: '', dtEmissaoInicio: '', dtEmissaoFim: '', vencimentoInicio: '', vencimentoFim: '' })}
            className="text-xs text-slate-500 hover:text-slate-300 px-2 underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Modal de estorno */}
      {estornando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-1">Estornar Nota</h2>
            <p className="text-sm text-slate-400 mb-4">
              A nota voltará para o compras. Informe o motivo da devolução.
            </p>
            <textarea
              value={justificativa}
              onChange={e => setJustificativa(e.target.value)}
              placeholder="Descreva a divergência encontrada..."
              rows={4}
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5
                         placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/40 resize-none"
              autoFocus
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => { setEstornando(null); setJustificativa('') }}
                disabled={enviandoEstorno}
                className="text-sm text-slate-400 hover:text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEstorno}
                disabled={!justificativa.trim() || enviandoEstorno}
                className="bg-red-600 hover:bg-red-500 disabled:bg-red-600/30 disabled:cursor-not-allowed
                           text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all"
              >
                {enviandoEstorno ? 'Estornando...' : 'Confirmar Estorno'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              {[
                { label: 'NF', key: 'numero' },
                { label: 'Emissor', key: 'emissor_nome' },
                { label: 'Fazenda', key: 'fazenda' },
                { label: 'Valor', key: 'valor' },
                { label: 'Data Emissão', key: 'dt_emissao' },
                { label: 'Data Rec.', key: 'data_recebimento' },
                { label: 'Forma Pag.', key: null },
                { label: 'Pedidos', key: null },
                { label: 'Vencimento', key: 'vencimento' },
                { label: 'Status', key: null },
                { label: 'Ação', key: null },
              ].map(({ label, key }) => (
                <th key={label} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {key ? (
                    <button
                      onClick={() => handleSort(key)}
                      className="flex items-center gap-1 hover:text-slate-300"
                    >
                      {label} <SortIcon column={key} />
                    </button>
                  ) : (
                    label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {!loading && protocolosFiltrados.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-slate-500 text-sm">
                  {protocolos.length === 0 ? 'Nenhuma nota encontrada' : 'Nenhuma nota corresponde aos filtros'}
                </td>
              </tr>
            )}
            {protocolosPaginados.map((p: any) => (
              <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3 text-sm text-white font-medium">{p.numero}</td>
                <td className="px-4 py-3 text-xs text-slate-400 max-w-[120px] truncate" title={p.emissor_nome}>{p.emissor_nome}</td>
                <td className="px-4 py-3 text-xs text-slate-300">{p.fazenda_nome || p.ie_tomador}</td>
                <td className="px-4 py-3 text-sm text-white">
                  {Number(p.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{formatDateBR(p.dt_emissao)}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{formatDateBR(p.data_recebimento)}</td>
                <td className="px-4 py-3 text-xs text-slate-300">{p.forma_pagamento || '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-300">{p.pedidos || '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-300">{p.vencimento ? formatDateBR(p.vencimento) : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.concluida
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {p.concluida ? `✓ ${p.responsavel_nome || ''}` : 'Pendente'}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {canAct(p) && !p.concluida ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => concluir(p.id)}
                        disabled={concluindo === p.id}
                        className="text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-900/50
                                   hover:border-emerald-700 disabled:opacity-50 px-2.5 py-1 rounded transition-all"
                      >
                        {concluindo === p.id ? '...' : 'Concluir'}
                      </button>
                      <button
                        onClick={() => abrirEstorno(p.id)}
                        className="text-xs text-red-400 hover:text-red-300 border border-red-900/50
                                   hover:border-red-700 px-2.5 py-1 rounded transition-all"
                      >
                        Estornar
                      </button>
                    </div>
                  ) : canAct(p) && p.concluida ? (
                    <button
                      onClick={() => abrirEstorno(p.id)}
                      className="text-xs text-red-400 hover:text-red-300 border border-red-900/50
                                 hover:border-red-700 px-2.5 py-1 rounded transition-all"
                    >
                      Estornar
                    </button>
                  ) : (
                    <span className="text-xs text-slate-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && protocolosOrdenados.length > PAGE_SIZE && (
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
