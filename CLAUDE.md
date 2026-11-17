# Finanças — dashboard financeiro pessoal e familiar

@AGENTS.md

## Visão
App privado (casal → família) para controlar receitas, despesas, cartões, metas e lançar gastos por
mensagem (WhatsApp/Telegram + IA). **Custo zero** é requisito: avise antes de qualquer coisa paga.
O usuário é dev júnior: explique decisões e liste passos manuais. Textos de UI e docs em **pt-BR**.
Uso principal no **iPhone** → todo trabalho de UI é validado em iPhone 15, iPhone SE e Android 360×800.

Repositório: https://github.com/NycollasMartins/Dashboard_Financas (público, por escolha do dono).

## Stack
Next.js 16.4 (App Router, Turbopack, **Cache Components + Partial Prefetching**) · React 19.3 · TypeScript 5.9 ·
Tailwind 4.3 · shadcn/ui `base-nova` (**Base UI**, não Radix: `render={<X/>}` em vez de `asChild`) ·
Supabase (Postgres 17, Auth, RLS, **pg_cron**) · Zod 4 · Vitest 5 · pgTAP · Playwright 1.65 (WebKit) · Vercel.

## Arquitetura (resumo — detalhes em `docs/`)
- **Workspace** = espaço `personal` (1 por usuário) ou `household` (família). Todo dado financeiro tem
  `workspace_id`. Espaço ativo em `profiles.last_workspace_id`.
- **Isolamento no banco**: RLS em todas as tabelas via `private.my_workspace_ids()` / `private.is_admin()`;
  FKs compostas `(id, workspace_id)`; triggers forçam `created_by`, bloqueiam troca de `workspace_id`.
- **Regra contábil (ADR-0010)**: compra no crédito = despesa (competência); **pagamento de fatura NÃO é
  despesa** (`invoice_payments`); transferência (`transfers`) não é receita nem despesa.
- **Nada derivado é armazenado**: status de fatura, saldos e limite vêm das views `card_invoice_summaries`,
  `account_balances`, `credit_card_summaries` (`security_invoker`).
- Regras de data (fatura, parcelas, recorrência) existem **em SQL e em TS** (`src/lib/domain`) com os
  **mesmos casos de teste** — mudou um, mude o outro.
- Recorrências: geradas por trigger na criação + pg_cron diário (`gerar-recorrencias`, 03:00 BRT), idempotentes.
- Auditoria (`audit_log`) em vez de soft delete; "desfazer" via `restore_deleted_transaction`.
- Server Actions usam o cliente com a sessão do usuário (`src/lib/supabase/server.ts`), nunca a secret key.
- `src/proxy.ts` (ex-middleware) só renova sessão e redireciona; autorização real = banco.

## Estrutura
```
src/app/(auth)/            entrar, cadastro, recuperar/redefinir senha, convite/[token]
src/app/(app)/             painel, lancamentos, cartoes(/[id]), contas, recorrencias, categorias, familia, configuracoes, mais
src/app/(app)/_actions/    server actions da Fase 2 (ledger.ts)
src/components/ledger/     entry-sheet (lançamento rápido), listas, formulários, money-input, category-icon
src/components/ui/         shadcn + sheet.tsx (folha inferior no celular)
src/lib/domain/            regras puras (invoice.ts, recurrence.ts) + testes
src/lib/data/ledger.ts     consultas server-only da Fase 2
supabase/migrations/       0001 núcleo · 0002 financeiro · 0003 canais · 0004 membros · 0005 conta · 0006 Fase 2
supabase/tests/database/   pgTAP (122 asserções)   ·   supabase/seed.sql: usuários + mês de demonstração
e2e/                       Playwright: auth, conta, lançamentos, checagens iOS, screenshots do README
scripts/                   dev-lan.mjs (celular no Wi-Fi), generate-icons.mjs (ícones PWA)
docs/                      requisitos, modelo-de-dados, adr/ (0001–0013), design-system, roadmap, setup-manual, images/
```

## Convenções obrigatórias
- **Dinheiro em centavos** (`bigint`/inteiro, sufixo `_cents`). Use `parseBRL`/`formatBRL`/`<Money>`/`<MoneyInput>`.
- **Datas**: competência = `date`; "hoje" via `todayISO()` (TS) ou `private.today_sp()` (SQL). Nunca `date_trunc`
  em funções `IMMUTABLE` (depende do fuso) — use `private.month_start`/`private.add_months`.
- **Nova tabela** ⇒ `workspace_id` + FKs compostas + RLS (bloco `do $$` da 0002/0006) + trigger de auditoria + pgTAP.
- **Migrations nunca são editadas** depois de commitadas; crie uma nova. Depois: `pnpm db:types` e `pnpm db:reset`.
- Server Action: Zod → `requireUser()` → cliente do usuário → `fail()/ok()` → `revalidatePath("/", "layout")`.
- Páginas em `(app)`: shell estático + conteúdo que lê sessão dentro de `<Suspense>` (ADR-0008).
- **Grids de página**: use `grid-cols-[minmax(0,1fr)]` (sem isso, textos longos estouram a largura no iPhone).
- Folhas (`Sheet`) com formulário longo: `scroll={false}` + rodapé fixo fora da área rolável (botão sempre tocável).
- UI: só tokens do design system; alvos de toque ≥ 44 px; inputs com fonte ≥ 16 px; `inputMode="decimal"` em valores.
- Não chamar funções de arquivo `"use client"` em Server Components; helpers compartilhados vão em `src/lib`.
- SVG repetido na página: **sem ids** (`<defs>`/gradientes quebram quando uma cópia está oculta).
- Segredos só em `.env.local`/Vercel; arquivo que lê segredo começa com `import "server-only"`.
- Commits pequenos, **Conventional Commits em pt-BR** (`feat(escopo): …`); push ao fim de cada etapa com
  testes passando; **nunca force push na main**.

## Comandos
| Comando | O quê |
|---|---|
| `pnpm dev` / `pnpm dev:lan` | Servidor local / acessível no celular pelo Wi-Fi |
| `pnpm check` | typecheck + lint + Vitest + pgTAP |
| `pnpm test:e2e` (`:ios`, `:ui`) | Playwright: desktop + iPhone 15 + iPhone SE + Android |
| `pnpm screenshots` | Regera `docs/images/*` (rode após `pnpm db:reset`) |
| `pnpm db:start / stop / reset / types` | Supabase local |

## Testes mobile / iOS
- Mac **sem Xcode** hoje → Playwright WebKit com emulação (projetos em `playwright.config.ts`) e
  **Playwright MCP** em `.mcp.json` (`playwright-iphone`, `playwright-iphone-se`).
- Com Xcode instalado: XcodeBuildMCP para o iOS Simulator (passo a passo no README).
- Checagens em `e2e/mobile-ios.spec.ts`: overflow horizontal, barra inferior fixa e 44 px, safe area,
  fonte ≥ 16 px, meta tags PWA/apple-touch-icon, `100dvh`, folha cabe na tela.
- Next 16 mantém a tela anterior **oculta no DOM**: em testes use `{ exact: true }`/`filter({ visible: true })`.

## Status das fases
- [x] **Fase 0** — Planejamento
- [x] **Fase 1** — Fundação + troca de e-mail, exclusão de conta, transferência de posse
- [x] **Fase 2** — Lançamentos (3 toques), categorias/subcategorias, contas, transferências, cartões, faturas
      calculadas, pagamento de fatura, parcelamento com escopo, recorrências (pg_cron), auditoria/desfazer
- [ ] Fase 3 — Dashboard e gráficos (incluir visão "por competência" × "por fatura")
- [ ] Fase 4 — Metas e projeções
- [ ] Fase 5 — IA (Gemini + Groq atrás de `AiParser`)
- [ ] Fase 6 — WhatsApp Cloud API + Telegram (adapters)
- [ ] Fase 7 — Importação CSV/OFX + leitura de prints
- [ ] Fase 8 — PWA completo (service worker), CSP, retenção do audit_log, deploy final

## Pendências conhecidas
- iOS Simulator/iPhone físico ainda não validados (emulação WebKit cobre layout; ver ADR-0012).
- Painel ainda mostra KPIs simples; gráficos na Fase 3.
- `audit_log` sem retenção (Fase 8).
