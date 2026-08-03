'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

const emptyForm = () => ({
  numero: '',
  valor: '',
  emissorNome: '',
  cnpjEmissor: '',
  chave: '',
  ieTomador: '',
  dtEmissao: '',
})

export default function IncluirNotaPage() {
  const { data: session } = useSession()
  const [fazendas, setFazendas] = useState<any[]>([])
  const [form, setForm] = useState(emptyForm())
  const [salvando, setSalvando] = useState(false)
  const [resultado, setResultado] = useState<{ ok?: boolean; error?: string } | null>(null)

  const perfil = (session?.user as any)?.perfil

  useEffect(() => {
    fetch('/api/fazendas').then(r => r.json()).then(setFazendas)
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

  function setField(patch: Partial<ReturnType<typeof emptyForm>>) {
    setForm(prev => ({ ...prev, ...patch }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setResultado(null)

    const res = await fetch('/api/notas/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setResultado(res.ok ? { ok: true } : { error: data.error })
    if (res.ok) setForm(emptyForm())
    setSalvando(false)
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Incluir Nota</h1>
        <p className="text-slate-400 text-sm mt-1">
          Cadastre manualmente uma nota fiscal que não veio pela importação do Fiscal.io
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Número da Nota</label>
            <input
              type="text"
              value={form.numero}
              onChange={e => setField({ numero: e.target.value })}
              required
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2
                         focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Valor</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.valor}
              onChange={e => setField({ valor: e.target.value })}
              required
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2
                         focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1.5">Emissor (Nome)</label>
          <input
            type="text"
            value={form.emissorNome}
            onChange={e => setField({ emissorNome: e.target.value })}
            required
            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">CNPJ/CPF Emissor</label>
            <input
              type="text"
              value={form.cnpjEmissor}
              onChange={e => setField({ cnpjEmissor: e.target.value })}
              placeholder="Somente números"
              required
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2
                         placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Data de Emissão</label>
            <input
              type="date"
              value={form.dtEmissao}
              onChange={e => setField({ dtEmissao: e.target.value })}
              required
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2
                         focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1.5">Chave de Acesso</label>
          <input
            type="text"
            value={form.chave}
            onChange={e => setField({ chave: e.target.value.replace(/\D/g, '') })}
            placeholder="44 dígitos (NF-e) ou 50 (NFS-e)"
            required
            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 font-mono
                       placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1.5">Fazenda (Tomador)</label>
          <select
            value={form.ieTomador}
            onChange={e => setField({ ieTomador: e.target.value })}
            required
            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="">Selecionar...</option>
            {fazendas.map(f => (
              <option key={f.id} value={f.ie_tomador}>{f.nome} — IE {f.ie_tomador}</option>
            ))}
          </select>
        </div>

        {resultado?.error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3">
            {resultado.error}
          </div>
        )}
        {resultado?.ok && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-lg px-4 py-3">
            ✓ Nota incluída com sucesso
          </div>
        )}

        <button
          type="submit"
          disabled={salvando}
          className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/30 disabled:cursor-not-allowed
                     text-slate-950 font-semibold rounded-lg px-5 py-2.5 text-sm transition-all"
        >
          {salvando ? 'Salvando...' : 'Incluir Nota'}
        </button>
      </form>
    </div>
  )
}
