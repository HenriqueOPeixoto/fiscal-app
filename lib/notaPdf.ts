import { readdir } from 'fs/promises'
import path from 'path'
import { limparChave } from './notasHelpers'

// Chaves muito curtas (ex: notas manuais com chave incompleta) casariam com qualquer nome de arquivo
const TAMANHO_MINIMO_CHAVE = 20

export const pastaPdfConfigurada = () => !!process.env.PDF_FOLDER

// Os PDFs ficam todos direto na raiz de PDF_FOLDER, com a chave em algum ponto do nome
// (ex: "NFe3524...-procNFe.pdf") — o nome é normalizado igual à chave antes de comparar
export async function encontrarPdf(chave: string): Promise<string | null> {
  const pasta = process.env.PDF_FOLDER
  const chaveNorm = limparChave(chave || '').toLowerCase()
  if (!pasta || chaveNorm.length < TAMANHO_MINIMO_CHAVE) return null

  let arquivos: string[]
  try {
    const entradas = await readdir(pasta, { withFileTypes: true })
    arquivos = entradas
      .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.pdf'))
      .map(e => e.name)
  } catch (e) {
    console.error('[nota-pdf] erro ao ler pasta de PDFs:', e)
    return null
  }

  const nome = arquivos.find(a => limparChave(a).toLowerCase().includes(chaveNorm))
  return nome ? path.join(pasta, nome) : null
}
