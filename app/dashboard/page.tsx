'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface Stats {
  totalProtocolos: number
  pendentes: number
  concluidas: number
  semProtocolo: number
}

function ultimoDiaDoMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  return `${mes}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [protocolos, setProtocolos] = useState<any[]>([])
  const [notasSemProtocolo, setNotasSemProtocolo] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingSemProtocolo, setLoadingSemProtocolo] = useState(true)

  const mesAtual = new Date().toISOString().slice(0, 7)
  const [filtroMes, setFiltroMes] = useState(mesAtual)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/protocolo?mes=${filtroMes}`)
      .then(r => r.json())
      .then(data => { setProtocolos(data); setLoading(false) })
  }, [filtroMes])

  useEffect(() => {
    fetch('/api/notas?semProtocolo=true')
      .then(r => r.json())
      .then(data => { setNotasSemProtocolo(data); setLoadingSemProtocolo(false) })
  }, [])

  const inicioMes = `${filtroMes}-01`
  const fimMes = ultimoDiaDoMes(filtroMes)
  const semProtocolo = notasSemProtocolo.filter(n => {
    const dtEmissao = n.dt_emissao?.slice(0, 10) || ''
    return dtEmissao >= inicioMes && dtEmissao <= fimMes
  }).length

  const stats: Stats = {
    totalProtocolos: protocolos.length,
    pendentes: protocolos.filter(p => !p.concluida).length,
    concluidas: protocolos.filter(p => p.concluida).length,
    semProtocolo,
  }

  const pct = stats.totalProtocolos > 0
    ? Math.round((stats.concluidas / stats.totalProtocolos) * 100)
    : 0

  const perfil = (session?.user as any)?.perfil

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-white">Olá, {session?.user?.name?.split(' ')[0]} 👋</h1>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={filtroMes}
            onChange={e => setFiltroMes(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
          {filtroMes !== mesAtual && (
            <button
              onClick={() => setFiltroMes(mesAtual)}
              className="text-xs text-slate-500 hover:text-slate-300 underline"
            >
              Mês atual
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Pendentes de Protocolo"
          value={loadingSemProtocolo ? '...' : stats.semProtocolo}
          color="white"
        />
        <StatCard
          label="Total Protocolados"
          value={loading ? '...' : stats.totalProtocolos}
          color="slate"
        />
        <StatCard
          label="Pendentes"
          value={loading ? '...' : stats.pendentes}
          color="amber"
        />
        <StatCard
          label="Concluídos"
          value={loading ? '...' : stats.concluidas}
          color="emerald"
        />
      </div>

      {/* Progress */}
      {!loading && stats.totalProtocolos > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-300">Progresso do mês</span>
            <span className="text-sm font-semibold text-emerald-400">{pct}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {stats.concluidas} de {stats.totalProtocolos} notas concluídas
          </p>
        </div>
      )}

      {/* Recent */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-white">Últimas notas protocoladas</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Carregando...</div>
        ) : protocolos.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">Nenhuma nota este mês</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {protocolos.slice(0, 8).map((p: any) => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm text-white font-medium">NF {p.numero}</span>
                  <span className="text-slate-500 text-xs ml-2">{p.emissor_nome}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-300">
                    {Number(p.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.concluida
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {p.concluida ? 'Concluída' : 'Pendente'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: any; color: string }) {
  const colors: Record<string, string> = {
    slate: 'text-slate-300',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    white: 'text-white',
  }
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-3xl font-bold ${colors[color]}`}>{value}</p>
    </div>
  )
}
