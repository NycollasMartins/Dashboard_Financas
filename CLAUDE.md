# Finanças — dashboard financeiro pessoal e familiar

@AGENTS.md

## Visão
App privado (casal → família) para controlar receitas, despesas, cartões, metas e lançar gastos por
mensagem (WhatsApp/Telegram + IA). **Custo zero** é requisito: avise antes de qualquer coisa paga.
O usuário é dev júnior: explique decisões e liste passos manuais. Textos de UI e docs em **pt-BR**.

## Stack
Next.js 16 (App Router, Turbopack, **Cache Components ligado**) · TypeScript · Tailwind v4 ·
shadcn/ui estilo `base-nova` (**Base UI**, não Radix: use `render={<X/>}` em vez de `asChild`) ·
Supabase (Postgres 17, Auth, RLS) · Zod 4 · Vitest · pgTAP · Vercel.

## Arquitetura (resumo — detalhes em `docs/`)
- **Workspace** = espaço `personal` (1 por usuário, criado no cadastro) ou `household` (família).
  Todo dado financeiro tem `workspace_id`. Espaço ativo em `profiles.last_workspace_id`.
- **Isolamento no banco**: RLS em todas as tabelas via `private.my_workspace_ids()` / `private.is_admin()`;
  FKs compostas `(id, workspace_id)`; triggers forçam `created_by` e bloqueiam troca de `workspace_id`.
- Operações com regra = **RPCs SECURITY DEFINER** (`create_household`, `create_workspace_invite`,
  `accept_workspace_invite`, `get_workspace_members`, `create_channel_link_code`).
- Server Actions usam o cliente com a sessão do usuário (`src/lib/supabase/server.ts`), nunca a secret key.
- `src/proxy.ts` (ex-middleware) só renova sessão e redireciona; autorização real = banco.

## Estrutura
```
src/app/(auth)/        entrar, cadastro, recuperar-senha, redefinir-senha, convite/[token], actions.ts
src/app/(app)/         painel, familia, configuracoes, lancamentos|cartoes|metas (placeholders), actions.ts
src/app/auth/confirm/  verifica token_hash dos e-mails
src/components/        ui/ (shadcn), app-shell/, forms/, brand/, money, page-header, empty-state
src/lib/               env, money, dates, safe-redirect, errors, action-state, validation/, supabase/, workspaces/
supabase/migrations/   0001 núcleo · 0002 financeiro · 0003 canais · 0004 diretório de membros
supabase/tests/        pgTAP (RLS)   ·   supabase/seed.sql: usuários de teste locais
docs/                  requisitos, modelo-de-dados, adr/, design-system, roadmap, setup-manual
```

## Convenções obrigatórias
- **Dinheiro em centavos** (`bigint`/inteiro, sufixo `_cents`). Use `parseBRL`/`formatBRL`/`<Money>`. Nunca float.
- **Datas**: competência = `date` `YYYY-MM-DD`; "hoje" via `todayISO()` (America/Sao_Paulo).
- **Nova tabela** ⇒ `workspace_id` + FKs compostas + RLS (copiar o bloco `do $$` da 0002) + teste pgTAP.
- **Migrations nunca são editadas** depois de aplicadas; crie uma nova. Depois: `pnpm db:types`.
- Server Action: validar com Zod → `requireUser()` → cliente Supabase do usuário → `fail()/ok()`
  (`src/lib/action-state.ts`) → `revalidatePath`. Erros ao usuário via `dbErrorMessage`/`authErrorMessage`.
- Páginas em `(app)`: shell estático + conteúdo que lê sessão dentro de `<Suspense>` (ADR-0008).
- Não chamar funções de arquivo `"use client"` em Server Components; helpers compartilhados vão em `src/lib`.
- Segredos só em `.env.local`/Vercel; arquivo que lê segredo começa com `import "server-only"`.
- UI: só tokens do design system (`bg-card`, `text-income`…); alvos de toque ≥ 44 px.
- Commits pequenos, mensagem em pt-BR no formato `tipo(escopo): descrição`.

## Comandos
`pnpm dev` · `pnpm check` (typecheck+lint+vitest+pgTAP) · `pnpm build` · `pnpm db:start|stop|reset|types` · `pnpm test:db`

## Status das fases
- [x] **Fase 0** — Planejamento (docs/requisitos.md, modelo-de-dados.md, adr/, design-system.md, roadmap.md)
- [x] **Fase 1** — Fundação: auth completo, workspaces + RLS (59 testes pgTAP), família/convites,
      alternância de espaço, shell responsivo, tema escuro/claro. Schema financeiro completo já migrado.
- [ ] Fase 2 — Lançamentos, categorias, contas, cartões/faturas, parcelamento, recorrências (pg_cron)
- [ ] Fase 3 — Dashboard e gráficos
- [ ] Fase 4 — Metas e projeções
- [ ] Fase 5 — IA (Gemini + Groq atrás de `AiParser`)
- [ ] Fase 6 — WhatsApp Cloud API + Telegram (adapters)
- [ ] Fase 7 — Importação CSV/OFX + leitura de prints
- [ ] Fase 8 — PWA, E2E, deploy final e hardening (CSP)

## Pendências conhecidas
- Layout mobile ainda não foi validado visualmente num viewport real de celular (só desktop).
- Troca de e-mail e exclusão de conta: não implementadas (Fase 8; exigir transferência de dono).
- Botão "+" (lançamento rápido) é placeholder até a Fase 2.
