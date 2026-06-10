'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

const STATUS_LABEL: Record<string, string> = {
  'Cancelamento de NF-e homologado': 'Cancelamento',
  'NFS-e de Substituição Gerada': 'Substituição',
}

export default function CanceladasPage() {
  const { data: session } = useSession()
  const [notas, setNotas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7))

  useEffect(() => {
    setLoading(true)
    fetch(`/api/canceladas?mes=${filtroMes}`)
      .then(r => r.json())
      .then(data => { setNotas(data); setLoading(false) })
  }, [filtroMes])

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Notas Canceladas</h1>
        <p className="text-slate-400 text-sm mt-1">
          Notas com status de cancelamento ou substituição identificadas na importação
        </p>
      </div>

      {/* Filtro */}
      <div className="flex gap-3 mb-6 items-center">
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
            Ver todos os períodos
          </button>
        )}
        <span className="text-sm text-slate-500">
          {loading ? 'Carregando...' : `${notas.length} nota(s)`}
        </span>
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
            {!loading && notas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500 text-sm">
                  Nenhuma nota cancelada neste período
                </td>
              </tr>
            )}
            {notas.map((n: any) => (
              <tr key={n.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3 text-sm text-white font-medium">{n.numero}</td>
                <td className="px-4 py-3 text-xs text-slate-400 max-w-[160px] truncate" title={n.emissor_nome}>
                  {n.emissor_nome}
                </td>
                <td className="px-4 py-3 text-xs text-slate-300">{n.fazenda_nome || n.ie_tomador}</td>
                <td className="px-4 py-3 text-sm text-white">
                  {Number(n.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{n.dt_emissao?.slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    n.status === 'Cancelamento de NF-e homologado'
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {STATUS_LABEL[n.status] ?? n.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{n.importado_em?.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
