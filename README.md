# Protocolo Fiscal

Sistema de controle de notas fiscais para os departamentos de Compras e Fiscal.

## Tecnologias
- **Next.js 15** (App Router, full-stack) + React 19
- **PostgreSQL** + **Drizzle ORM** (`pg` + `drizzle-orm/node-postgres`)
- **NextAuth.js** — autenticação com sessão JWT (Credentials provider)
- **Tailwind CSS 4** — estilização
- **xlsx (SheetJS)** — leitura de arquivos Excel exportados do Fiscal.io
- **fast-xml-parser** — importação automática de NF-e/NFS-e/CT-e via monitoramento de pasta
- **jsPDF + jspdf-autotable** — exportação de PDF (lista de notas pendentes de protocolo)

---

## Instalação

### Pré-requisitos
- Node.js 18+
- npm
- Um banco PostgreSQL acessível (local ou remoto)

### Passos

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com a DATABASE_URL do seu Postgres (veja abaixo)

# 3. Iniciar servidor de desenvolvimento
npm run dev

# 4. Popular usuários e fazendas iniciais
npm run seed
```

Acesse: http://localhost:3000

> O schema do banco (tabelas, colunas novas) é criado/migrado automaticamente na inicialização do servidor (`instrumentation.ts` → `initDB()` em `lib/db.ts`), via `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Não é preciso rodar migração manual — basta o servidor subir com uma `DATABASE_URL` válida.

### Variáveis de ambiente (`.env`)

| Variável | Uso |
|---|---|
| `DATABASE_URL` | String de conexão do Postgres (`postgres://usuario:senha@host:porta/banco`) |
| `NEXTAUTH_SECRET` | Segredo do NextAuth — **troque em produção** |
| `NEXTAUTH_URL` | URL pública da aplicação |
| `AUTH_TRUST_HOST` | Necessário atrás de proxy/reverse-proxy |
| `DB_USER`, `DB_PASSWORD` | Não usadas pela aplicação (resquício de uma tentativa antiga de containerizar o app — pode ignorar) |
| `XML_WATCH_FOLDER` | Pasta monitorada para importação automática de XML. Em branco desativa a funcionalidade |
| `XML_WATCH_INTERVAL_MS` | Intervalo do monitoramento (padrão 60000ms) |
| `XML_BATCH_SIZE` | Máximo de arquivos processados por ciclo (padrão 20) |

---

## Usuários iniciais (criados pelo seed)

| Email | Senha | Perfil |
|---|---|---|
| admin@empresa.com | admin123 | Admin |
| compras@empresa.com | compras123 | Compras |
| fiscal@empresa.com | fiscal123 | Fiscal |

> **Troque as senhas após o primeiro login via painel Admin.**

---

## Fluxo de uso

### Departamento de Compras
1. **Importar Notas** → faz upload do arquivo `.xlsx` exportado do Fiscal.io (ou deixa a importação automática via XML cuidar disso — veja abaixo)
2. **Incluir Nota** → cadastro manual de uma nota avulsa (número, valor, emissor, CNPJ, chave, fazenda, data de emissão)
3. **Protocolar** → seleciona as notas recebidas, preenche Fazenda (IE), Forma de Pagamento, Pedidos, Vencimento e Observação, e clica em Protocolar
4. **Canceladas** → consulta notas marcadas como canceladas/substituídas
5. **Relatório** → acompanha o status de qualquer nota no sistema

### Departamento Fiscal
1. **Lançamentos** → visualiza as notas protocoladas pelo Compras, filtráveis por mês e status (Pendente/Concluída); notas com vencimento vencido ou nos próximos 5 dias (e ainda não concluídas) ficam destacadas
2. **Concluir** um lançamento ao finalizar, ou **Estornar** (devolve a nota para o Compras com justificativa obrigatória)
3. **Relatório** → mesmo relatório consolidado disponível para o Compras

### Admin
- Acessa tudo acima (Compras + Fiscal)
- **Usuários** → cria novos usuários, define perfil, ativa/desativa, redefine senha
- **Fazendas** → cadastro de fazendas (nome + IE do tomador), usado para vincular notas importadas
- **Logs** → auditoria de ações do sistema, filtrável por mês e categoria

### Importação automática por XML (opcional)
Se `XML_WATCH_FOLDER` estiver configurada, o servidor monitora essa pasta em background (`lib/xmlImport.ts`, iniciado por `instrumentation.ts`), processando arquivos NF-e, NFS-e e CT-e a cada `XML_WATCH_INTERVAL_MS`. Notas importadas assim ficam atribuídas a um usuário de sistema fixo. Arquivos processados vão para `processados/`; falhas vão para `erros/` e ficam registradas em Logs.

---

## Regras de acesso

| Ação | Compras | Fiscal | Admin |
|---|---|---|---|
| Ver Dashboard / Relatório | ✅ | ✅ | ✅ |
| Importar Excel / Incluir Nota manual | ✅ | ❌ | ✅ |
| Editar ou excluir nota (antes de protocolar) | ✅ | ❌ | ✅ |
| Cancelar nota | ✅ | ❌ | ✅ |
| Protocolar notas | ✅ | ❌ | ✅ |
| Ver Canceladas | ✅ | — (sem link no menu) | ✅ |
| Preencher lançamento fiscal / Concluir | ❌ | ✅ (se o lançamento estiver livre ou for seu) | ✅ (qualquer um) |
| Estornar protocolo (devolve ao Compras) | ❌ | ✅ (se o lançamento estiver livre ou for seu) | ✅ (qualquer um) |
| Gerenciar usuários | ❌ | ❌ | ✅ |
| Gerenciar fazendas | ❌ | ❌ | ✅ |
| Ver Logs | ❌ | ❌ | ✅ |

---

## Estrutura do projeto

```
/app
  /api
    /auth/[...nextauth]     → login/logout (NextAuth)
    /notas                  → importação (.xlsx), listagem, edição, exclusão, cancelamento
    /notas/manual           → inclusão manual de nota avulsa
    /protocolo               → protocolar notas e estornar protocolo (Compras/Fiscal)
    /lancamento              → lançamentos fiscais (Fiscal)
    /canceladas               → listagem de notas canceladas
    /relatorio                → relatório consolidado por nota
    /usuarios                 → gestão de usuários (Admin)
    /fazendas                  → CRUD de fazendas (Admin)
    /logs                       → auditoria (Admin)
    /data-servidor               → data atual do servidor
  /dashboard                → visão geral com indicadores do mês
  /importar                 → upload do Excel (Compras)
  /incluir-nota              → inclusão manual de nota (Compras)
  /protocolar                → protocolar notas selecionadas (Compras)
  /fiscal                    → lançamentos do Fiscal
  /canceladas                → notas canceladas/substituídas
  /relatorio                  → relatório consolidado (todos os perfis)
  /admin                      → gestão de usuários
  /admin/fazendas               → gestão de fazendas
  /admin/logs                    → auditoria
  /login                      → página de login
/components
  Sidebar.tsx                → navegação lateral (recolhível, com preview ao passar o mouse)
/lib
  db.ts                      → conexão Postgres + criação/migração automática do schema
  schema.ts                  → schema Drizzle (fonte da verdade — prisma/schema.prisma está obsoleto)
  auth.ts                    → configuração NextAuth
  xmlImport.ts                → monitoramento de pasta e importação automática de XML
  logger.ts                    → gravação de entradas de auditoria
/scripts
  seed.ts                     → popula usuários e fazendas iniciais
instrumentation.ts            → inicializa o banco e o monitor de XML no boot do servidor
```

---

## Banco de dados (PostgreSQL)

A aplicação usa **PostgreSQL** via `pg` + Drizzle ORM (`lib/db.ts`). Não há mais banco SQLite local — qualquer `.db` remanescente no diretório é resquício de uma versão antiga e pode ser removido.

O schema é definido em `lib/schema.ts` e criado/migrado automaticamente a cada boot do servidor (`initDB()`), então não é necessário rodar uma migração manual ao atualizar o código — apenas reiniciar a aplicação.

Tabelas principais: `usuarios`, `fazendas`, `notas`, `protocolos`, `lancamentos_fiscal`, `notas_canceladas`, `logs`.

---

## Produção

```bash
npm run build
npm start
```

Requer uma `DATABASE_URL` de Postgres acessível no ambiente de produção (ex.: Supabase, Neon, RDS, ou um Postgres gerenciado na própria infraestrutura).
