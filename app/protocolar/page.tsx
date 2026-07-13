'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

type ExtraFields = {
  responsavel: string
  formaPagamento: string
  pedidos: string
  vencimento: string
}

const emptyExtra = (): ExtraFields => ({ responsavel: '', formaPagamento: '', pedidos: '', vencimento: '' })

export default function ProtocolarPage() {
  const { data: session } = useSession()
  const [notas, setNotas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [dataRecebimento, setDataRecebimento] = useState('')
  const [extraFields, setExtraFields] = useState<Record<string, ExtraFields>>({})
  const [salvando, setSalvando] = useState(false)
  const [resultado, setResultado] = useState<string>('')
  const [tentouProtocolar, setTentouProtocolar] = useState(false)
  // per-nota responsável save state: null | 'saving' | 'saved'
  const [respState, setRespState] = useState<Record<string, 'saving' | 'saved'>>({})
  const [filtros, setFiltros] = useState({ numero: '', emissor: '', fazenda: '', dtEmissao: new Date().toISOString().slice(0, 7) })
  const [somenteEstornadas, setSomenteEstornadas] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: '', direction: 'asc' })
  const [cancelandoNota, setCancelandoNota] = useState<{ id: string; numero: string } | null>(null)
  const [cancelarStatus, setCancelarStatus] = useState('Cancelamento de NF-e homologado')
  const [cancelarLoading, setCancelarLoading] = useState(false)

  const perfil = (session?.user as any)?.perfil

  async function carregarNotas() {
    const data = await fetch('/api/notas?semProtocolo=true').then(r => r.json())
    setNotas(data)
    // Pre-fill responsavel from saved nota value, keep any unsaved edits already in state
    setExtraFields(prev => {
      const next = { ...prev }
      for (const nota of data) {
        if (nota.responsavel_pagamento && !prev[nota.id]) {
          next[nota.id] = { ...emptyExtra(), responsavel: nota.responsavel_pagamento }
        }
      }
      return next
    })
    setLoading(false)
  }

  useEffect(() => {
    carregarNotas()
    fetch('/api/data-servidor').then(r => r.json()).then(d => setDataRecebimento(d.hoje))
  }, [])

  if (perfil === 'fiscal') {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-5 text-sm">
          Acesso restrito ao departamento de Compras.
        </div>
      </div>
    )
  }

  const notasFiltradas = notas.filter(n => {
    if (filtros.numero && !n.numero.toLowerCase().includes(filtros.numero.toLowerCase())) return false
    if (filtros.emissor && !n.emissor_nome.toLowerCase().includes(filtros.emissor.toLowerCase())) return false
    if (filtros.fazenda) {
      const faz = (n.fazenda_nome || n.ie_tomador || '').toLowerCase()
      if (!faz.includes(filtros.fazenda.toLowerCase())) return false
    }
    if (filtros.dtEmissao && !n.dt_emissao?.startsWith(filtros.dtEmissao)) return false
    if (somenteEstornadas && !n.estorno_justificativa) return false
    return true
  })
  const temFiltro = somenteEstornadas || Object.values(filtros).some(v => v !== '')

  function getSortValue(nota: any, key: string) {
    switch (key) {
      case 'numero': return nota.numero || ''
      case 'emissor_nome': return nota.emissor_nome || ''
      case 'fazenda': return nota.fazenda_nome || nota.ie_tomador || ''
      case 'valor': return Number(nota.valor) || 0
      case 'dt_emissao': return nota.dt_emissao || ''
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

  function handleSort(key: string) {
    setSortConfig(prev => prev.key === key
      ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: 'asc' })
  }

  function SortIcon({ column }: { column: string }) {
    if (sortConfig.key !== column) return <span className="text-slate-600">⇕</span>
    return <span className="text-emerald-400">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
  }

  function getExtra(notaId: string): ExtraFields {
    return extraFields[notaId] ?? emptyExtra()
  }

  function setExtra(notaId: string, patch: Partial<ExtraFields>) {
    setExtraFields(prev => ({ ...prev, [notaId]: { ...getExtra(notaId), ...patch } }))
  }

  async function salvarResponsavel(notaId: string) {
    setRespState(prev => ({ ...prev, [notaId]: 'saving' }))
    await fetch(`/api/notas/${notaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responsavelPagamento: getExtra(notaId).responsavel }),
    })
    setRespState(prev => ({ ...prev, [notaId]: 'saved' }))
    setTimeout(() => setRespState(prev => { const n = { ...prev }; delete n[notaId]; return n }), 2000)
    // Update the underlying nota so re-renders reflect saved value
    setNotas(prev => prev.map(n => n.id === notaId ? { ...n, responsavel_pagamento: getExtra(notaId).responsavel } : n))
  }

  function toggleAll() {
    const ids = notasFiltradas.map(n => n.id)
    const allChecked = ids.every(id => selecionadas.has(id))
    const next = new Set(selecionadas)
    if (allChecked) ids.forEach(id => next.delete(id))
    else ids.forEach(id => next.add(id))
    setSelecionadas(next)
  }

  const selecionadasSemForma = Array.from(selecionadas).filter(
    id => !getExtra(id).formaPagamento.trim()
  )
  const podeProtocolar = selecionadas.size > 0 && selecionadasSemForma.length === 0

  async function confirmarCancelar() {
    if (!cancelandoNota) return
    setCancelarLoading(true)
    await fetch(`/api/notas/${cancelandoNota.id}/cancelar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: cancelarStatus }),
    })
    setCancelandoNota(null)
    setCancelarLoading(false)
    setSelecionadas(prev => { const n = new Set(prev); n.delete(cancelandoNota.id); return n })
    await carregarNotas()
  }

  async function handleProtocolar() {
    setTentouProtocolar(true)
    if (!podeProtocolar) return
    setSalvando(true)
    setResultado('')

    let ok = 0, erros = 0
    for (const notaId of selecionadas) {
      const extra = getExtra(notaId)
      const res = await fetch('/api/protocolo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notaId,
          responsavelFormaPag: extra.responsavel || null,
          formaPagamento: extra.formaPagamento,
          pedidos: extra.pedidos || null,
          vencimento: extra.vencimento || null,
        }),
      })
      if (res.ok) ok++
      else erros++
    }

    setResultado(`${ok} nota(s) protocolada(s)${erros ? `, ${erros} com erro` : ''}`)
    setSelecionadas(new Set())
    setExtraFields({})
    setTentouProtocolar(false)
    await carregarNotas()
    setSalvando(false)
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Protocolar Notas</h1>
        <p className="text-slate-400 text-sm mt-1">
          Selecione as notas recebidas e registre para o departamento fiscal
        </p>
      </div>

      {/* Global form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6 flex gap-4 flex-wrap items-end">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Data de Recebimento</label>
          <div className="bg-slate-800/50 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2">
            {dataRecebimento ? dataRecebimento.split('-').reverse().join('/') : '—'}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <button
            onClick={handleProtocolar}
            disabled={!selecionadas.size || salvando}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/30 disabled:cursor-not-allowed
                       text-slate-950 font-semibold rounded-lg px-5 py-2 text-sm transition-all"
          >
            {salvando ? 'Salvando...' : `Protocolar (${selecionadas.size})`}
          </button>
          {tentouProtocolar && selecionadasSemForma.length > 0 && (
            <p className="text-xs text-red-400">
              {selecionadasSemForma.length} nota(s) sem Forma de Pagamento definida
            </p>
          )}
        </div>
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
        <input
          type="month"
          value={filtros.dtEmissao}
          onChange={e => setFiltros(prev => ({ ...prev, dtEmissao: e.target.value }))}
          className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2
                     focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          title="Data de Emissão"
        />
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
            onClick={() => { setFiltros({ numero: '', emissor: '', fazenda: '', dtEmissao: '' }); setSomenteEstornadas(false) }}
            className="text-xs text-slate-500 hover:text-slate-300 px-2 underline"
          >
            Limpar filtros
          </button>
        )}
        {temFiltro && (
          <span className="text-sm text-slate-500 ml-auto">
            {notasFiltradas.length} de {notas.length} nota(s)
          </span>
        )}
      </div>

      {resultado && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-lg px-4 py-3 mb-4">
          ✓ {resultado}
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-3">
          <input
            type="checkbox"
            checked={notasFiltradas.length > 0 && notasFiltradas.every(n => selecionadas.has(n.id))}
            onChange={toggleAll}
            className="w-4 h-4 accent-emerald-500"
          />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {loading ? 'Carregando...' : `${notasFiltradas.length} notas sem protocolo`}
          </span>
        </div>

        {!loading && notasFiltradas.length > 0 && (
          <div className="px-5 py-2 border-b border-slate-800 flex items-center gap-4">
            <div className="w-4 flex-shrink-0" />
            <div className="flex-1 grid grid-cols-4 gap-4">
              <button
                onClick={() => handleSort('numero')}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 text-left"
              >
                Número <SortIcon column="numero" />
              </button>
              <button
                onClick={() => handleSort('emissor_nome')}
                className="col-span-2 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 text-left"
              >
                Emissor <SortIcon column="emissor_nome" />
              </button>
              <button
                onClick={() => handleSort('fazenda')}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 text-left"
              >
                Fazenda <SortIcon column="fazenda" />
              </button>
            </div>
            <div className="text-right flex-shrink-0 w-32 flex flex-col items-end gap-0.5">
              <button
                onClick={() => handleSort('valor')}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300"
              >
                Valor <SortIcon column="valor" />
              </button>
              <button
                onClick={() => handleSort('dt_emissao')}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300"
              >
                Emissão <SortIcon column="dt_emissao" />
              </button>
            </div>
          </div>
        )}

        {!loading && notasFiltradas.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">
            {notas.length === 0 ? 'Nenhuma nota pendente de protocolo' : 'Nenhuma nota corresponde aos filtros'}
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {notasOrdenadas.map((nota: any) => {
              const extra = getExtra(nota.id)
              const checked = selecionadas.has(nota.id)
              const formaInvalida = tentouProtocolar && checked && !extra.formaPagamento.trim()
              const rs = respState[nota.id]
              const respChanged = extra.responsavel !== (nota.responsavel_pagamento ?? '')
              return (
                <div key={nota.id} className={`px-5 py-3.5 transition-colors ${checked ? 'bg-emerald-500/5' : 'hover:bg-slate-800/50'}`}>
                  {/* Row 1: checkbox + nota info */}
                  <label className="flex items-center gap-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => {
                        const next = new Set(selecionadas)
                        e.target.checked ? next.add(nota.id) : next.delete(nota.id)
                        setSelecionadas(next)
                        if (!e.target.checked) setTentouProtocolar(false)
                      }}
                      className="w-4 h-4 accent-emerald-500 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0 grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-slate-500">Número</p>
                        <p className="text-sm text-white font-medium">{nota.numero}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-slate-500">Emissor</p>
                        <p className="text-sm text-slate-300 truncate">{nota.emissor_nome}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Fazenda</p>
                        <p className="text-sm text-slate-300">{nota.fazenda_nome || nota.ie_tomador}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 w-32">
                      <p className="text-sm font-semibold text-white">
                        {Number(nota.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                      <p className="text-xs text-slate-500">{nota.dt_emissao?.slice(0, 10)}</p>
                    </div>
                  </label>
                  <div className="mt-1 ml-8 flex justify-end">
                    <button
                      onClick={() => { setCancelandoNota({ id: nota.id, numero: nota.numero }); setCancelarStatus('Cancelamento de NF-e homologado') }}
                      className="text-xs text-slate-600 hover:text-red-400 transition-colors"
                    >
                      Marcar como cancelada
                    </button>
                  </div>

                  {/* Estorno warning */}
                  {nota.estorno_justificativa && (
                    <div className="mt-2 ml-8 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      <span className="text-red-400 text-xs mt-0.5">⚠</span>
                      <div>
                        <p className="text-xs font-medium text-red-400">
                          Estornada por {nota.estornada_por} em {nota.estorno_em?.slice(0, 10)}
                        </p>
                        <p className="text-xs text-red-300/80 mt-0.5">{nota.estorno_justificativa}</p>
                      </div>
                    </div>
                  )}

                  {/* Row 2: per-note payment fields */}
                  <div className="mt-2.5 ml-8 flex gap-3 flex-wrap items-end">
                    {/* Responsável — saveable independently */}
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Responsável Pagamento</label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={extra.responsavel}
                          onChange={e => setExtra(nota.id, { responsavel: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') salvarResponsavel(nota.id) }}
                          placeholder="Ex: BRUNA"
                          className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 w-36
                                     placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                        <button
                          onClick={() => salvarResponsavel(nota.id)}
                          disabled={rs === 'saving' || (!respChanged && rs !== 'saved')}
                          className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all whitespace-nowrap
                            ${rs === 'saved'
                              ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                              : respChanged
                                ? 'border-slate-600 text-slate-300 hover:text-white hover:border-slate-400'
                                : 'border-slate-700 text-slate-600 cursor-not-allowed'}`}
                        >
                          {rs === 'saving' ? '...' : rs === 'saved' ? '✓ Salvo' : 'Salvar'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className={`block text-xs mb-1 ${formaInvalida ? 'text-red-400 font-medium' : 'text-slate-500'}`}>
                        Forma de Pagamento{formaInvalida ? ' — obrigatória' : ''}
                      </label>
                      <select
                        value={extra.formaPagamento}
                        onChange={e => setExtra(nota.id, { formaPagamento: e.target.value })}
                        className={`text-white text-xs rounded-lg px-2.5 py-1.5 w-40
                                   focus:outline-none focus:ring-1 transition-colors
                                   ${formaInvalida
                                     ? 'bg-red-500/10 border border-red-500/50 focus:ring-red-500/50'
                                     : 'bg-slate-800 border border-slate-700 focus:ring-emerald-500/50'}`}
                      >
                        <option value="">Selecionar...</option>
                        <option value="BOLETO">BOLETO</option>
                        <option value="PIX">PIX</option>
                        <option value="TRANSFERÊNCIA">TRANSFERÊNCIA</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Pedidos</label>
                      <input
                        type="text"
                        value={extra.pedidos}
                        onChange={e => setExtra(nota.id, { pedidos: e.target.value })}
                        placeholder="Nº pedido"
                        className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 w-28
                                   placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Vencimento</label>
                      <input
                        type="date"
                        value={extra.vencimento}
                        onChange={e => setExtra(nota.id, { vencimento: e.target.value })}
                        className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5
                                   focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {/* Modal: cancelar nota */}
      {cancelandoNota && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-semibold text-base mb-1">Cancelar nota</h3>
            <p className="text-slate-400 text-sm mb-5">
              NF <span className="text-white font-medium">{cancelandoNota.numero}</span> será movida para a tela de Canceladas.
            </p>
            <p className="text-xs font-medium text-slate-400 mb-2">Motivo do cancelamento</p>
            <div className="space-y-2 mb-6">
              {['Cancelamento de NF-e homologado', 'NFS-e de Substituição Gerada'].map(opt => (
                <label key={opt} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="radio"
                    name="cancelar-status"
                    value={opt}
                    checked={cancelarStatus === opt}
                    onChange={() => setCancelarStatus(opt)}
                    className="accent-emerald-500"
                  />
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{opt}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setCancelandoNota(null)}
                disabled={cancelarLoading}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarCancelar}
                disabled={cancelarLoading}
                className="px-4 py-2 text-sm bg-red-500/80 hover:bg-red-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-all"
              >
                {cancelarLoading ? 'Movendo...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
