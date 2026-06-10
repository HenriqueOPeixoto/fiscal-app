# Protocolo Fiscal

Sistema de controle de notas fiscais para os departamentos de Compras e Fiscal.

## Tecnologias
- **Next.js 15** (App Router, full-stack)
- **Drizzle ORM + libSQL (SQLite)** — banco de dados local, zero configuração
- **NextAuth.js** — autenticação com sessão JWT
- **Tailwind CSS** — estilização
- **xlsx (SheetJS)** — leitura de arquivos Excel

---

## Instalação

### Pré-requisitos
- Node.js 18+
- npm

### Passos

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env se necessário

# 3. Inicializar banco de dados e usuários iniciais
npm run seed

# 4. Iniciar servidor de desenvolvimento
npm run dev
```

Acesse: http://localhost:3000

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
1. **Importar Notas** → faz upload do arquivo `.xlsx` exportado do Fiscal.io
2. **Protocolar** → seleciona as notas recebidas, informa data de recebimento e quem deve informar a forma de pagamento, clica em Protocolar

### Departamento Fiscal
1. **Lançamentos** → visualiza todas as notas protocoladas pelo Compras
2. Filtra por mês e status (Pendente / Concluída)
3. Clica em **Editar** para preencher: Forma de pagamento, Pedidos, Vencimento, Identificada, Anotações
4. Marca como **Concluída** ao finalizar

### Admin
- Acessa tudo acima
- **Usuários** → cria novos usuários, define perfil (Compras/Fiscal/Admin), ativa/desativa

---

## Regras de acesso

| Ação | Compras | Fiscal | Admin |
|---|---|---|---|
| Importar Excel | ✅ | ❌ | ✅ |
| Protocolar notas | ✅ | ❌ | ✅ |
| Preencher campos fiscais | ❌ | ✅ | ✅ |
| Editar lançamento próprio | ❌ | ✅ | ✅ |
| Editar lançamento de outro | ❌ | ❌ | ✅ |
| Gerenciar usuários | ❌ | ❌ | ✅ |

---

## Estrutura do projeto

```
/app
  /api
    /auth/[...nextauth]   → login/logout
    /notas                → importação e listagem
    /protocolo            → protocolar notas (Compras)
    /lancamento           → lançamentos fiscais
    /usuarios             → gestão de usuários
  /dashboard              → visão geral com indicadores
  /importar               → upload do Excel (Compras)
  /protocolar             → protocolar notas selecionadas
  /fiscal                 → lançamentos do Fiscal
  /admin                  → gestão de usuários (Admin)
  /login                  → página de login
/components
  Sidebar.tsx             → navegação lateral
/lib
  db.ts                   → conexão com banco
  schema.ts               → schema Drizzle
  auth.ts                 → configuração NextAuth
/scripts
  seed.ts                 → inicialização do banco
```

---

## Banco de dados (SQLite local)

O arquivo `fiscal.db` é criado automaticamente ao rodar o seed.
Para produção, considere migrar para **Turso** (libSQL gerenciado) ou **PostgreSQL** (Supabase).

---

## Produção

```bash
npm run build
npm start
```

Para deploy recomendado: **Vercel** (gratuito para times pequenos) ou **Railway**.
