import { readdir, readFile, rename, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { XMLParser } from 'fast-xml-parser'
import { client, SISTEMA_XML_USER_ID } from './db'
import { log } from './logger'
import { normalizeIE, normalizeNumero, stripNul, chaveValida, limparChave } from './notasHelpers'

const SISTEMA_XML_USER_NOME = 'Importação Automática (XML)'

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })

type NotaExtraida = {
  numero: string
  valor: number
  emissorNome: string
  cnpjEmissor: string
  ieTomador: string
  chave: string
  dtEmissao: string
}

function extrairChave(id: unknown): string {
  // O atributo Id vem como "NFe"+chave ou "NFS"+chave — a chave em si pode ser alfanumérica
  return limparChave(String(id || '').replace(/^NFe|^NFS/i, ''))
}

// NF-e — layout nacional (Sefaz), estável há anos: nfeProc > NFe > infNFe (ou NFe > infNFe sem o wrapper de protocolo)
function extrairNFe(doc: any): NotaExtraida | null {
  const infNFe = doc?.nfeProc?.NFe?.infNFe ?? doc?.NFe?.infNFe
  if (!infNFe) return null
  const ide = infNFe.ide ?? {}
  const emit = infNFe.emit ?? {}
  const dest = infNFe.dest ?? {}
  const total = infNFe.total?.ICMSTot ?? {}
  return {
    numero: normalizeNumero(String(ide.nNF ?? '')),
    valor: parseFloat(String(total.vNF ?? '0')),
    emissorNome: stripNul(String(emit.xNome ?? '')).trim(),
    cnpjEmissor: String(emit.CNPJ ?? '').replace(/\D/g, ''),
    ieTomador: normalizeIE(String(dest.IE ?? '')),
    chave: extrairChave(infNFe['@_Id']),
    dtEmissao: stripNul(String(ide.dhEmi ?? ide.dEmi ?? '')).slice(0, 10),
  }
}

// NFS-e Nacional (SPED/Sefin Nacional) — NFSe > infNFSe, confirmado contra amostras reais de 5 municípios diferentes.
// O tomador nunca traz IE nesse layout (só CPF/CNPJ) — mesma regra de "IE opcional" já usada no resto do sistema.
function extrairNFSe(doc: any): NotaExtraida | null {
  const infNFSe = doc?.NFSe?.infNFSe
  if (!infNFSe) return null
  const emit = infNFSe.emit ?? {}
  const valores = infNFSe.valores ?? {}
  const infDPS = infNFSe.DPS?.infDPS ?? {}
  return {
    numero: normalizeNumero(String(infNFSe.nNFSe ?? '')),
    valor: parseFloat(String(valores.vLiq ?? '0')),
    emissorNome: stripNul(String(emit.xNome ?? '')).trim(),
    cnpjEmissor: String(emit.CNPJ ?? '').replace(/\D/g, ''),
    ieTomador: '',
    chave: extrairChave(infNFSe['@_Id']),
    dtEmissao: stripNul(String(infDPS.dhEmi ?? '')).slice(0, 10),
  }
}

async function garantirSubpastas(base: string) {
  await mkdir(path.join(base, 'processados'), { recursive: true })
  await mkdir(path.join(base, 'erros'), { recursive: true })
}

async function moverArquivo(base: string, nomeArquivo: string, subpasta: 'processados' | 'erros') {
  await rename(path.join(base, nomeArquivo), path.join(base, subpasta, nomeArquivo))
}

async function registrarErro(base: string, nomeArquivo: string, motivo: string) {
  await log(SISTEMA_XML_USER_ID, SISTEMA_XML_USER_NOME, 'nota_xml_erro', `${nomeArquivo}: ${motivo}`)
  try {
    await moverArquivo(base, nomeArquivo, 'erros')
  } catch {
    // se nem mover for possível (ex: permissão), deixa o arquivo onde está — tenta de novo no próximo ciclo
  }
}

async function processarArquivo(base: string, nomeArquivo: string) {
  const caminho = path.join(base, nomeArquivo)
  let nota: NotaExtraida | null

  try {
    const conteudo = await readFile(caminho, 'utf8')
    const doc = parser.parse(conteudo)
    nota = extrairNFe(doc) ?? extrairNFSe(doc)
  } catch (e: any) {
    await registrarErro(base, nomeArquivo, `XML inválido: ${e.message}`)
    return
  }

  if (!nota) {
    await registrarErro(base, nomeArquivo, 'Tipo de XML não reconhecido (não é NF-e nem NFS-e)')
    return
  }

  const { numero, valor, emissorNome, cnpjEmissor, ieTomador, chave, dtEmissao } = nota

  if (!numero || !emissorNome || !chave || !valor || isNaN(valor)) {
    await registrarErro(base, nomeArquivo, `Dados obrigatórios ausentes no XML (NF ${numero || '?'})`)
    return
  }

  if (!chaveValida(chave)) {
    await registrarErro(base, nomeArquivo, `Chave de acesso com tamanho inválido (${chave.length} dígitos) — NF ${numero}`)
    return
  }

  // Notas fiscais de serviço (NFS-e) não possuem Tomador IE — só validamos a fazenda quando a nota informa uma IE
  if (ieTomador) {
    const fazenda = await client.execute({ sql: 'SELECT 1 FROM fazendas WHERE ie_tomador = ?', args: [ieTomador] })
    if (!fazenda.rows.length) {
      await registrarErro(base, nomeArquivo, `Fazenda não cadastrada (IE ${ieTomador}) — NF ${numero}`)
      return
    }
  }

  try {
    const r = await client.execute({
      sql: `INSERT INTO notas (id, numero, valor, emissor_nome, cnpj_emissor, chave, ie_tomador, dt_emissao, importado_por_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT DO NOTHING`,
      args: [randomUUID(), numero, valor, emissorNome, cnpjEmissor, chave, ieTomador, dtEmissao, SISTEMA_XML_USER_ID],
    })
    if (r.rowsAffected > 0) {
      await log(SISTEMA_XML_USER_ID, SISTEMA_XML_USER_NOME, 'nota_importada_xml',
        `Importou NF ${numero} — ${emissorNome} (arquivo ${nomeArquivo})`)
    }
    // rowsAffected === 0 significa que já existia (mesma chave) — não é erro, o arquivo só não precisa ser reimportado
    await moverArquivo(base, nomeArquivo, 'processados')
  } catch (e: any) {
    await registrarErro(base, nomeArquivo, `Erro ao gravar no banco: ${e.message}`)
  }
}

let emExecucao = false

export async function varrerPasta(base: string) {
  if (emExecucao) return
  emExecucao = true
  try {
    await garantirSubpastas(base)
    const entradas = await readdir(base, { withFileTypes: true })
    const todosXml = entradas
      .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.xml'))
      .map(e => e.name)

    // Processa em lotes por ciclo (por padrão, 1 ciclo = 1 minuto — ver XML_WATCH_INTERVAL_MS)
    // pra não sobrecarregar a pasta de rede/banco se um monte de XML chegar de uma vez
    const tamanhoLote = Number(process.env.XML_BATCH_SIZE) || 20
    const arquivosXml = todosXml.slice(0, tamanhoLote)
    if (todosXml.length > arquivosXml.length) {
      console.log(`[xml-import] ${todosXml.length} arquivo(s) na pasta, processando ${arquivosXml.length} neste ciclo (restante fica pro próximo)`)
    }

    for (const nomeArquivo of arquivosXml) {
      await processarArquivo(base, nomeArquivo)
    }
  } finally {
    emExecucao = false
  }
}

let iniciado = false

export function iniciarMonitoramentoXml() {
  if (iniciado) return
  iniciado = true

  const pasta = process.env.XML_WATCH_FOLDER
  if (!pasta) {
    console.log('[xml-import] XML_WATCH_FOLDER não configurado — monitoramento de pasta desativado')
    return
  }

  const intervalo = Number(process.env.XML_WATCH_INTERVAL_MS) || 60000

  const executar = () => {
    varrerPasta(pasta).catch(e => console.error('[xml-import] erro ao varrer pasta:', e))
  }

  executar()
  setInterval(executar, intervalo)
  console.log(`[xml-import] monitorando "${pasta}" a cada ${intervalo}ms`)
}
