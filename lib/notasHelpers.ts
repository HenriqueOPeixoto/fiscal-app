export const normalizeIE = (ie: string) => String(ie).replace(/\D/g, '').replace(/^0+/, '')
export const normalizeNumero = (n: string) => String(n).trim().replace(/^0+(?=\d)/, '')

// Postgres rejects NUL bytes in text columns outright ("null character not permitted"),
// unlike SQLite which stored them silently — strip them from free-text fields coming from spreadsheets/XML
const NUL = String.fromCharCode(0)
export const stripNul = (s: string) => s.split(NUL).join('')

// NF-e access keys are 44 digits, NFS-e (Nacional) are 50 — mas nem toda prefeitura já padronizou
// a NFS-e nesse formato, então por enquanto aceitamos qualquer tamanho até 50 dígitos
export const chaveValida = (chave: string) => chave.length <= 50

// Chaves podem ser alfanuméricas (nem toda nota de serviço usa só dígitos) — mantém letras e números,
// só remove espaços/pontuação (ex: espaços que aparecem quando a chave é copiada de um PDF em blocos)
export const limparChave = (chave: string) => String(chave).replace(/[^a-zA-Z0-9]/g, '')
