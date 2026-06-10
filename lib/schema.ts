import { sql } from 'drizzle-orm'
import { text, integer, real, sqliteTable } from 'drizzle-orm/sqlite-core'

export const usuarios = sqliteTable('usuarios', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  email: text('email').notNull().unique(),
  senha: text('senha').notNull(),
  perfil: text('perfil').notNull(), // 'compras' | 'fiscal' | 'admin'
  ativo: integer('ativo', { mode: 'boolean' }).notNull().default(true),
  criadoEm: text('criado_em').notNull().default(sql`(datetime('now'))`),
})

export const fazendas = sqliteTable('fazendas', {
  id: text('id').primaryKey(),
  ieTomador: text('ie_tomador').notNull().unique(),
  nome: text('nome').notNull(),
})

export const notas = sqliteTable('notas', {
  id: text('id').primaryKey(),
  numero: text('numero').notNull(),
  valor: real('valor').notNull(),
  emissorNome: text('emissor_nome').notNull(),
  ieTomador: text('ie_tomador').notNull(),
  dtEmissao: text('dt_emissao').notNull(),
  importadoEm: text('importado_em').notNull().default(sql`(datetime('now'))`),
  importadoPorId: text('importado_por_id').notNull().references(() => usuarios.id),
})

export const protocolos = sqliteTable('protocolos', {
  id: text('id').primaryKey(),
  notaId: text('nota_id').notNull().unique().references(() => notas.id),
  dataRecebimento: text('data_recebimento').notNull(),
  responsavelFormaPag: text('responsavel_forma_pag'),
  criadoEm: text('criado_em').notNull().default(sql`(datetime('now'))`),
  criadoPorId: text('criado_por_id').notNull().references(() => usuarios.id),
})

export const lancamentosFiscal = sqliteTable('lancamentos_fiscal', {
  id: text('id').primaryKey(),
  protocoloId: text('protocolo_id').notNull().unique().references(() => protocolos.id),
  formaPagamento: text('forma_pagamento'),
  concluida: integer('concluida', { mode: 'boolean' }).notNull().default(false),
  concluidaEm: text('concluida_em'),
  identificada: integer('identificada', { mode: 'boolean' }).notNull().default(false),
  pedidos: text('pedidos'),
  vencimento: text('vencimento'),
  anotacoes: text('anotacoes'),
  criadoEm: text('criado_em').notNull().default(sql`(datetime('now'))`),
  atualizadoEm: text('atualizado_em').notNull().default(sql`(datetime('now'))`),
  responsavelId: text('responsavel_id').notNull().references(() => usuarios.id),
})

// Types
export type Usuario = typeof usuarios.$inferSelect
export type Fazenda = typeof fazendas.$inferSelect
export type Nota = typeof notas.$inferSelect
export type Protocolo = typeof protocolos.$inferSelect
export type LancamentoFiscal = typeof lancamentosFiscal.$inferSelect
