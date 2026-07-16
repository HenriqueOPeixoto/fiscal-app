'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

export default function AdminPage() {
  const { data: session } = useSession()
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [novoForm, setNovoForm] = useState({ nome: '', email: '', senha: '', perfil: 'fiscal' })
  const [criando, setCriando] = useState(false)
  const [msg, setMsg] = useState('')
  const [alterandoPerfil, setAlterandoPerfil] = useState<string | null>(null)
  const [resetandoSenha, setResetandoSenha] = useState<{ id: string; nome: string } | null>(null)
  const [novaSenha, setNovaSenha] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const perfil = (session?.user as any)?.perfil

  useEffect(() => {
    if (perfil === 'admin') {
      fetch('/api/usuarios').then(r => r.json()).then(data => {
        setUsuarios(data)
        setLoading(false)
      })
    }
  }, [perfil])

  if (perfil !== 'admin') {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-5 text-sm">
          Acesso exclusivo para administradores.
        </div>
      </div>
    )
  }

  async function criarUsuario(e: React.FormEvent) {
    e.preventDefault()
    setCriando(true)
    setMsg('')
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novoForm),
    })
    const data = await res.json()
    if (res.ok) {
      setMsg('Usuário criado com sucesso!')
      setNovoForm({ nome: '', email: '', senha: '', perfil: 'fiscal' })
      const updated = await fetch('/api/usuarios').then(r => r.json())
      setUsuarios(updated)
    } else {
      setMsg(data.error || 'Erro ao criar usuário')
    }
    setCriando(false)
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await fetch('/api/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ativo: !ativo }),
    })
    const updated = await fetch('/api/usuarios').then(r => r.json())
    setUsuarios(updated)
  }

  async function alterarPerfil(id: string, perfil: string) {
    setAlterandoPerfil(id)
    await fetch('/api/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, perfil }),
    })
    const updated = await fetch('/api/usuarios').then(r => r.json())
    setUsuarios(updated)
    setAlterandoPerfil(null)
  }

  async function confirmarResetSenha() {
    if (!resetandoSenha || !novaSenha.trim()) return
    setResetLoading(true)
    await fetch('/api/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: resetandoSenha.id, senha: novaSenha }),
    })
    setResetLoading(false)
    setResetandoSenha(null)
    setNovaSenha('')
  }

  const PERFIL_BADGE: Record<string, string> = {
    admin: 'bg-purple-500/10 text-purple-400',
    compras: 'bg-blue-500/10 text-blue-400',
    fiscal: 'bg-emerald-500/10 text-emerald-400',
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Gerenciar Usuários</h1>
        <p className="text-slate-400 text-sm mt-1">Crie e gerencie os acessos do sistema</p>
      </div>

      {/* New user form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8">
        <h2 className="text-sm font-semibold text-white mb-4">Novo Usuário</h2>
        <form onSubmit={criarUsuario} className="flex gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Nome"
            value={novoForm.nome}
            onChange={e => setNovoForm({ ...novoForm, nome: e.target.value })}
            required
            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 w-40
                       placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
          <input
            type="email"
            placeholder="Email"
            value={novoForm.email}
            onChange={e => setNovoForm({ ...novoForm, email: e.target.value })}
            required
            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 w-52
                       placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
          <input
            type="password"
            placeholder="Senha"
            value={novoForm.senha}
            onChange={e => setNovoForm({ ...novoForm, senha: e.target.value })}
            required
            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 w-36
                       placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
          <select
            value={novoForm.perfil}
            onChange={e => setNovoForm({ ...novoForm, perfil: e.target.value })}
            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="fiscal">Fiscal</option>
            <option value="compras">Compras</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={criando}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/30 text-slate-950
                       font-semibold text-sm rounded-lg px-4 py-2 transition-all"
          >
            {criando ? 'Criando...' : 'Criar'}
          </button>
        </form>
        {msg && (
          <p className={`text-xs mt-3 ${msg.includes('sucesso') ? 'text-emerald-400' : 'text-red-400'}`}>
            {msg}
          </p>
        )}
      </div>

      {/* Users table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {loading ? 'Carregando...' : `${usuarios.length} usuários`}
          </span>
        </div>
        <div className="divide-y divide-slate-800">
          {usuarios.map((u: any) => (
            <div key={u.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-sm text-slate-300 font-medium flex-shrink-0">
                {u.nome[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">{u.nome}</p>
                <p className="text-xs text-slate-500">{u.email}</p>
              </div>
              <select
                value={u.perfil}
                disabled={alterandoPerfil === u.id}
                onChange={e => alterarPerfil(u.id, e.target.value)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium border-0 disabled:opacity-50
                            focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${PERFIL_BADGE[u.perfil] || ''}`}
              >
                <option value="fiscal">fiscal</option>
                <option value="compras">compras</option>
                <option value="admin">admin</option>
              </select>
              <button
                onClick={() => { setResetandoSenha({ id: u.id, nome: u.nome }); setNovaSenha('') }}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400
                           hover:border-emerald-500/50 hover:text-emerald-400 transition-all"
              >
                Redefinir senha
              </button>
              <button
                onClick={() => toggleAtivo(u.id, u.ativo)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                  u.ativo
                    ? 'border-slate-700 text-slate-400 hover:border-red-500/50 hover:text-red-400'
                    : 'border-emerald-500/30 text-emerald-400 hover:border-emerald-500/60'
                }`}
              >
                {u.ativo ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: redefinir senha */}
      {resetandoSenha && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-semibold text-base mb-1">Redefinir senha</h3>
            <p className="text-slate-400 text-sm mb-5">
              Nova senha para <span className="text-white font-medium">{resetandoSenha.nome}</span>.
            </p>
            <input
              type="password"
              value={novaSenha}
              onChange={e => setNovaSenha(e.target.value)}
              placeholder="Nova senha"
              autoFocus
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5 mb-6
                         placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setResetandoSenha(null); setNovaSenha('') }}
                disabled={resetLoading}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarResetSenha}
                disabled={!novaSenha.trim() || resetLoading}
                className="px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/30 disabled:cursor-not-allowed
                           text-slate-950 font-semibold rounded-lg transition-all"
              >
                {resetLoading ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
