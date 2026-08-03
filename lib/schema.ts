import { sql } from 'drizzle-orm'
import { text, real, boolean, pgTable } from 'drizzle-orm/pg-core'

const nowText = () => sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`

export const usuarios = pgTable('usuarios', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  email: text('email').notNull().unique(),
  senha: text('senha').notNull(),
  perfil: text('perfil').notNull(), // 'compras' | 'fiscal' | 'admin'
  ativo: boolean('ativo').notNull().default(true),
  criadoEm: text('criado_em').notNull().default(nowText()),
})

export const fazendas = pgTable('fazendas', {
  id: text('id').primaryKey(),
  ieTomador: text('ie_tomador').notNull().unique(),
  nome: text('nome').notNull(),
})

export const notas = pgTable('notas', {
  id: text('id').primaryKey(),
  numero: text('numero').notNull(),
  valor: real('valor').notNull(),
  emissorNome: text('emissor_nome').notNull(),
  cnpjEmissor: text('cnpj_emissor').notNull().default(''),
  chave: text('chave').notNull().default(''),
  ieTomador: text('ie_tomador').notNull(),
  dtEmissao: text('dt_emissao').notNull(),
  importadoEm: text('importado_em').notNull().default(nowText()),
  importadoPorId: text('importado_por_id').notNull().references(() => usuarios.id),
  responsavelPagamento: text('responsavel_pagamento'),
  formaPagamento: text('forma_pagamento'),
  pedidos: text('pedidos'),
  vencimento: text('vencimento'),
  estornoJustificativa: text('estorno_justificativa'),
  estornoEm: text('estorno_em'),
  estornadaPor: text('estornada_por'),
})

export const protocolos = pgTable('protocolos', {
  id: text('id').primaryKey(),
  notaId: text('nota_id').notNull().unique().references(() => notas.id),
  dataRecebimento: text('data_recebimento').notNull(),
  responsavelFormaPag: text('responsavel_forma_pag'),
  formaPagamento: text('forma_pagamento'),
  pedidos: text('pedidos'),
  vencimento: text('vencimento'),
  criadoEm: text('criado_em').notNull().default(nowText()),
  criadoPorId: text('criado_por_id').notNull().references(() => usuarios.id),
})

export const notasCanceladas = pgTable('notas_canceladas', {
  id: text('id').primaryKey(),
  numero: text('numero').notNull(),
  valor: real('valor').notNull(),
  emissorNome: text('emissor_nome').notNull(),
  cnpjEmissor: text('cnpj_emissor').notNull().default(''),
  chave: text('chave').notNull().default(''),
  ieTomador: text('ie_tomador').notNull(),
  dtEmissao: text('dt_emissao').notNull(),
  status: text('status').notNull(),
  importadoEm: text('importado_em').notNull().default(nowText()),
  importadoPorId: text('importado_por_id').notNull().references(() => usuarios.id),
})

export const lancamentosFiscal = pgTable('lancamentos_fiscal', {
  id: text('id').primaryKey(),
  protocoloId: text('protocolo_id').notNull().unique().references(() => protocolos.id),
  formaPagamento: text('forma_pagamento'),
  concluida: boolean('concluida').notNull().default(false),
  concluidaEm: text('concluida_em'),
  identificada: boolean('identificada').notNull().default(false),
  pedidos: text('pedidos'),
  vencimento: text('vencimento'),
  anotacoes: text('anotacoes'),
  criadoEm: text('criado_em').notNull().default(nowText()),
  atualizadoEm: text('atualizado_em').notNull().default(nowText()),
  responsavelId: text('responsavel_id').notNull().references(() => usuarios.id),
})

export const logs = pgTable('logs', {
  id: text('id').primaryKey(),
  usuarioId: text('usuario_id').notNull(),
  usuarioNome: text('usuario_nome').notNull(),
  acao: text('acao').notNull(),
  descricao: text('descricao').notNull(),
  criadoEm: text('criado_em').notNull().default(nowText()),
})

// Types
export type Usuario = typeof usuarios.$inferSelect
export type Fazenda = typeof fazendas.$inferSelect
export type Nota = typeof notas.$inferSelect
export type Protocolo = typeof protocolos.$inferSelect
export type NotaCancelada = typeof notasCanceladas.$inferSelect
export type LancamentoFiscal = typeof lancamentosFiscal.$inferSelect
