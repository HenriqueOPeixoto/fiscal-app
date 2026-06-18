'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

export default function FazendasPage() {
  const { data: session } = useSession()
  const [fazendas, setFazendas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nome: '', ieTomador: '' })
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  const [editando, setEditando] = useState<{ id: string; nome: string; ieTomador: string } | null>(null)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)

  const perfil = (session?.user as any)?.perfil

  async function carregar() {
    const data = await fetch('/api/fazendas').then(r => r.json())
    setFazendas(data)
    setLoading(false)
  }

  useEffect(() => { if (perfil === 'admin') carregar() }, [perfil])

  if (perfil !== 'admin') {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-5 text-sm">
          Acesso exclusivo para administradores.
        </div>
      </div>
    )
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setMsg('')
    const res = await fetch('/api/fazendas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (res.ok) {
      setMsg('Fazenda cadastrada com sucesso!')
      setForm({ nome: '', ieTomador: '' })
      await carregar()
    } else {
      setMsg(data.error || 'Erro ao cadastrar')
    }
    setSalvando(false)
  }

  async function salvarEdicao() {
    if (!editando) return
    setSalvando(true)
    setMsg('')
    const res = await fetch(`/api/fazendas/${editando.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: editando.nome, ieTomador: editando.ieTomador }),
    })
    const data = await res.json()
    if (res.ok) {
      setEditando(null)
      await carregar()
    } else {
      setMsg(data.error || 'Erro ao salvar')
    }
    setSalvando(false)
  }

  async function excluir(id: string) {
    setExcluindoId(id)
    await fetch(`/api/fazendas/${id}`, { method: 'DELETE' })
    setExcluindoId(null)
    await carregar()
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Fazendas</h1>
        <p className="text-slate-400 text-sm mt-1">
          Gerencie as fazendas e suas Inscrições Estaduais para vinculação com as notas
        </p>
      </div>

      {/* Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8">
        <h2 className="text-sm font-semibold text-white mb-4">Nova Fazenda</h2>
        <form onSubmit={criar} className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Nome</label>
            <input
              type="text"
              placeholder="Ex: Fazenda São João"
              value={form.nome}
              onChange={e => setForm({ ...form, nome: e.target.value })}
              required
              className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 w-56
                         placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Inscrição Estadual</label>
            <input
              type="text"
              placeholder="Ex: 123456789"
              value={form.ieTomador}
              onChange={e => setForm({ ...form, ieTomador: e.target.value })}
              required
              className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 w-44
                         placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <button
            type="submit"
            disabled={salvando}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/30
                       text-slate-950 font-semibold text-sm rounded-lg px-4 py-2 transition-all"
          >
            {salvando ? 'Salvando...' : 'Cadastrar'}
          </button>
        </form>
        {msg && (
          <p className={`text-xs mt-3 ${msg.includes('sucesso') ? 'text-emerald-400' : 'text-red-400'}`}>
            {msg}
          </p>
        )}
      </div>

      {/* List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {loading ? 'Carregando...' : `${fazendas.length} fazenda(s)`}
          </span>
        </div>
        <div className="divide-y divide-slate-800">
          {!loading && fazendas.length === 0 && (
            <div className="px-5 py-10 text-center text-slate-500 text-sm">
              Nenhuma fazenda cadastrada
            </div>
          )}
          {fazendas.map((f: any) => (
            <div key={f.id} className="flex items-center gap-4 px-5 py-3.5">
              {editando?.id === f.id ? (
                <>
                  <input
                    type="text"
                    value={editando.nome}
                    onChange={e => setEditando({ ...editando, nome: e.target.value })}
                    className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 w-52
                               focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  <input
                    type="text"
                    value={editando.ieTomador}
                    onChange={e => setEditando({ ...editando, ieTomador: e.target.value })}
                    className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 w-40
                               focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={salvarEdicao}
                      disabled={salvando}
                      className="text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-900/50
                                 hover:border-emerald-700 px-3 py-1.5 rounded-lg transition-all"
                    >
                      {salvando ? '...' : 'Salvar'}
                    </button>
                    <button
                      onClick={() => setEditando(null)}
                      className="text-xs text-slate-400 hover:text-white border border-slate-700
                                 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{f.nome}</p>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono">IE: {f.ie_tomador}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditando({ id: f.id, nome: f.nome, ieTomador: f.ie_tomador })}
                      className="text-xs text-slate-400 hover:text-white border border-slate-700
                                 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-all"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => excluir(f.id)}
                      disabled={excluindoId === f.id}
                      className="text-xs text-red-400 hover:text-red-300 border border-red-900/50
                                 hover:border-red-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-all"
                    >
                      {excluindoId === f.id ? '...' : 'Excluir'}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
