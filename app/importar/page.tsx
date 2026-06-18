'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function ImportarPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [drag, setDrag] = useState(false)

  const perfil = (session?.user as any)?.perfil
  if (perfil === 'fiscal') {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-5 text-sm">
          Acesso restrito ao departamento de Compras.
        </div>
      </div>
    )
  }

  async function handleImport() {
    if (!file) return
    setLoading(true)
    setResultado(null)

    const form = new FormData()
    form.append('file', file)

    const res = await fetch('/api/notas', { method: 'POST', body: form })
    const data = await res.json()
    setResultado(data)
    setLoading(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f?.name.endsWith('.xlsx')) setFile(f)
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Importar Notas</h1>
        <p className="text-slate-400 text-sm mt-1">
          Importe o arquivo exportado do Fiscal.io para registrar novas notas
        </p>
      </div>

      {/* Instructions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Colunas utilizadas do Fiscal.io</h3>
        <div className="grid grid-cols-2 gap-2">
          {['Num', 'Valor', 'Emissor Nome', 'Emissor CNPJ/CPF', 'Tomador IE', 'DtEmi', 'Status'].map(col => (
            <div key={col} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span className="text-xs text-slate-400 font-mono">{col}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Notas já existentes (mesmo número + CNPJ/CPF emissor + IE) serão ignoradas automaticamente.
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
          drag
            ? 'border-emerald-500 bg-emerald-500/5'
            : file
            ? 'border-emerald-500/50 bg-emerald-500/5'
            : 'border-slate-700 hover:border-slate-600 bg-slate-900'
        }`}
      >
        <input
          id="file-input"
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={e => setFile(e.target.files?.[0] || null)}
        />
        {file ? (
          <div>
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0" />
              </svg>
            </div>
            <p className="text-white font-medium text-sm">{file.name}</p>
            <p className="text-slate-500 text-xs mt-1">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
        ) : (
          <div>
            <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-slate-300 text-sm font-medium">Arraste o arquivo ou clique para selecionar</p>
            <p className="text-slate-500 text-xs mt-1">Somente arquivos .xlsx do Fiscal.io</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-4">
        {file && (
          <button
            onClick={() => { setFile(null); setResultado(null) }}
            className="px-4 py-2.5 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-all"
          >
            Limpar
          </button>
        )}
        <button
          onClick={handleImport}
          disabled={!file || loading}
          className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/30 disabled:cursor-not-allowed
                     text-slate-950 font-semibold rounded-lg px-4 py-2.5 text-sm transition-all"
        >
          {loading ? 'Importando...' : 'Importar Notas'}
        </button>
      </div>

      {/* Result */}
      {resultado && (
        <div className={`mt-5 rounded-xl p-5 border ${
          resultado.error
            ? 'bg-red-500/10 border-red-500/20'
            : 'bg-emerald-500/10 border-emerald-500/20'
        }`}>
          {resultado.error ? (
            <p className="text-red-400 text-sm">{resultado.error}</p>
          ) : (
            <div>
              <p className="text-emerald-400 font-semibold text-sm mb-2">✓ Importação concluída</p>
              <div className="space-y-1 text-sm">
                <p className="text-slate-300">
                  <span className="text-white font-medium">{resultado.importadas}</span> notas importadas
                </p>
                {resultado.canceladas > 0 && (
                  <p className="text-slate-300">
                    <span className="text-amber-400 font-medium">{resultado.canceladas}</span> notas canceladas/substituídas
                  </p>
                )}
                <p className="text-slate-400">
                  <span className="text-slate-300">{resultado.ignoradas}</span> ignoradas (já existiam ou inválidas)
                </p>
              </div>
              {resultado.ignoradasLista?.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">
                    Ver notas ignoradas ({resultado.ignoradasLista.length})
                  </summary>
                  <div className="mt-2 p-3 bg-slate-950 rounded-lg max-h-48 overflow-y-auto">
                    {resultado.ignoradasLista.map((n: { numero: string; emissor: string }, i: number) => (
                      <div key={i} className="flex gap-3 py-1 border-b border-slate-800 last:border-0">
                        <span className="text-xs text-slate-400 font-mono w-24 flex-shrink-0">{n.numero}</span>
                        <span className="text-xs text-slate-500 truncate">{n.emissor}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              <div className="flex gap-3 mt-3">
                {resultado.importadas > 0 && (
                  <button
                    onClick={() => router.push('/protocolar')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 underline"
                  >
                    Ir para Protocolar →
                  </button>
                )}
                {resultado.canceladas > 0 && (
                  <button
                    onClick={() => router.push('/canceladas')}
                    className="text-xs text-amber-400 hover:text-amber-300 underline"
                  >
                    Ver Canceladas →
                  </button>
                )}
              </div>
              {resultado.debug && (
                <details className="mt-4">
                  <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">
                    Diagnóstico (expandir)
                  </summary>
                  <div className="mt-2 p-3 bg-slate-950 rounded-lg space-y-2">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Colunas lidas do arquivo:</p>
                      <p className="text-xs text-slate-300 font-mono break-all">
                        {resultado.debug.colunas.join(' | ')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Valores de Status encontrados:</p>
                      {resultado.debug.statusVistos.map((s: string) => (
                        <p key={s} className="text-xs text-slate-300 font-mono">"{s}"</p>
                      ))}
                    </div>
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
