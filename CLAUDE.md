# Finanças — dashboard financeiro pessoal e familiar

@AGENTS.md

## Visão
App privado (casal → família) para controlar receitas, despesas, cartões, metas e lançar gastos por
mensagem (WhatsApp/Telegram + IA). **Custo zero** é requisito: avise antes de qualquer coisa paga.
O usuário é dev júnior: explique decisões e liste passos manuais. Textos de UI e docs em **pt-BR**.
Uso principal no **iPhone** → todo trabalho de UI é validado em iPhone 15, iPhone SE e Android 360×800.

Repositório: https://github.com/NycollasMartins/Dashboard_Financas (**privado**). CI: 2.000 min/mês no Free.
Vercel Hobby com repo privado só publica commits cujo autor é o dono (ver `docs/setup-manual.md` §D).

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
- **Painel (Fase 3)**: agregação no banco em `public.analytics_*` (`SECURITY INVOKER` → RLS vale nas somas).
  Visões **competência** (padrão) × **caixa** (crédito no vencimento da fatura) — ADR-0014/0015.
  Realizado × previsto sempre separados. Saldo projetado em `analytics_position`.
- **Metas (Fase 4)**: aporte **não é despesa** (ADR-0016): sai da conta, entra na reserva/caixinha; retirada
  com motivo. Aporte planejado = `recurrences.goal_id` → `goal_contributions` previstos. Toda regra de metas
  passa pela **API interna** `src/lib/goals/service.ts` (Zod + `Result`; reutilizada por IA/bot — docs/api-interna.md);
  cálculos puros em `src/lib/goals/math.ts`.
- **Projeção** (ADR-0017): `private.projected_occurrences` gera ocorrências virtuais após `last_generated_on`
  (até 36 meses); `analytics_entries` inclui por padrão (`is_projected`). Mês atual nunca muda.
- **Assistente (Fase 5)**: a IA **só interpreta** (ADR-0018). Fluxo: `interpret` (parser local → Gemini → Groq →
  local) → `resolveItem` (ids/perguntas) → `executor` (APIs internas, `source='assistant'`, `assistant_actions`
  com a mensagem original) → resposta por template. Ponto de entrada de TODO canal: `handleAssistant`
  (`src/lib/assistant/server/engine.ts`). Ao provedor só vão texto + data/hora + NOMES (ADR-0019, `prompt.ts`).
- Lançamentos passam pela API interna `src/lib/ledger/service.ts` (telas e assistente).
- Regras de data (fatura, parcelas, recorrência, competência×caixa, projeção) existem **em SQL e em TS** (`src/lib/domain`) com os
  **mesmos casos de teste** — mudou um, mude o outro.
- Recorrências: geradas por trigger na criação + pg_cron diário (`gerar-recorrencias`, 03:00 BRT), idempotentes.
- Auditoria (`audit_log`) em vez de soft delete; "desfazer" via `restore_deleted_transaction`.
- Server Actions usam o cliente com a sessão do usuário (`src/lib/supabase/server.ts`), nunca a secret key.
- `src/proxy.ts` (ex-middleware) só renova sessão e redireciona; autorização real = banco.

## Estrutura
```
src/app/(auth)/            entrar, cadastro, recuperar/redefinir senha, convite/[token]
src/app/(app)/             painel, lancamentos, cartoes(/[id]), contas, recorrencias, categorias, familia, configuracoes, mais
src/app/(app)/painel/      dashboard: blocos async com <Suspense>; load.ts deduplica RPCs com cache()
src/app/(app)/metas/       metas + detalhe [id];  planejamento/ = sobra, compromissos, distribuição
src/app/(app)/assistente/  chat do assistente (canal "app"); actions em _actions/assistant.ts
src/app/(app)/_actions/    server actions finas (ledger.ts, goals.ts, assistant.ts, preferences.ts)
src/components/dashboard/  KPIs, gráficos HTML/SVG (sem lib), toolbar de filtros (router.push), insights
src/components/privacy/    PrivacyProvider + PrivacyToggle (ocultar valores)
src/components/goals/      anel, cartão, gráfico, simulador, contribution-form (guardar/retirar), celebração
src/components/ledger/     entry-sheet (provider leve) + entry-form (carregado sob demanda), listas, formulários
src/components/ui/         shadcn + sheet.tsx (folha inferior no celular)
src/lib/domain/            regras puras (invoice.ts, recurrence.ts, basis.ts, projection.ts) + testes
src/lib/goals/             math.ts (puro, testado) + service.ts (API interna de metas)
src/lib/ledger/service.ts  API interna de lançamentos
src/lib/assistant/         parser local, money/dates, contrato Zod, providers/, eval/ (169+40 msgs), server/ (motor)
src/lib/analytics/         período, variação/tom, categorias, insights (puros, testados)
src/lib/data/              consultas server-only (ledger.ts, analytics.ts)
supabase/migrations/       0001 núcleo · 0002 financeiro · 0003 canais · 0004 membros · 0005 conta · 0006 Fase 2 · 0007 analytics · 0008 metas+projeção · 0009 assistente
supabase/tests/database/   pgTAP (224 asserções)   ·   supabase/seed.sql: ana/bruno/caio + 12 meses de demonstração
e2e/                       Playwright: auth, conta, lançamentos, checagens iOS, screenshots do README
scripts/                   dev-lan.mjs (celular no Wi-Fi), generate-icons.mjs (ícones PWA)
docs/                      requisitos, modelo-de-dados, adr/ (0001–0019), api-interna, design-system, roadmap, setup-manual, images/
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
- Campo de valor: sempre `<MoneyInput>` (máscara independente do cursor, `beforeinput`); em E2E use
  `getByLabel("Valor", { exact: true })` (o botão "Ocultar valores" também casa com "Valor").
- Valores na tela: sempre `<Money>` (ou `data-money` + `data-money-value`) para o "ocultar valores" funcionar.
- Gráficos: cores `viz-*` (validadas p/ daltonismo), um eixo só, tabela alternativa (`ChartFrame`), sem
  biblioteca de gráficos; primeira dobra sem fade de opacidade (LCP). Regras em `docs/design-system.md`.
- Filtros de tela que precisam do botão voltar: `router.push` (não `replace`).
- SVG repetido na página: **sem ids** (`<defs>`/gradientes quebram quando uma cópia está oculta).
- Nada de valores/saldos/e-mails no prompt da IA: só `buildUserPayload` monta o que sai (ADR-0019).
- Segredos só em `.env.local`/Vercel; arquivo que lê segredo começa com `import "server-only"`.
- Commits pequenos, **Conventional Commits em pt-BR** (`feat(escopo): …`); push ao fim de cada etapa com
  testes passando; **nunca force push na main**.

## Comandos
| Comando | O quê |
|---|---|
| `pnpm dev` / `pnpm dev:lan` | Servidor local / acessível no celular pelo Wi-Fi |
| `pnpm check` | typecheck + lint + Vitest + pgTAP + integração (precisa do db:start) |
| `pnpm test:integration` | Assistente mensagem → banco (Supabase local) |
| `pnpm eval:assistant` | Acurácia do parser local; `EVAL_PROVIDER=gemini\|groq` mede a IA real (gasta cota) |
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
- [x] **Fase 3** — Dashboard: KPIs + variação, saldo projetado, competência × caixa, realizado × previsto,
      gráficos, insights por regra, filtros na URL, ocultar valores, Lighthouse a11y 100 / perf 95 (throttling real)
- [x] **Fase 4** — Metas (aportes/retiradas, aporte planejado, conclusão), cálculos (mensal necessário, ritmo
      ponderado, estimativa), simulador, Planejamento, motor de projeção 36 meses, lista na visão caixa
- [x] **Fase 5** — Assistente no app: parser local + Gemini/Groq (só interpretam), 10 intenções, confirmação/perguntas,
      desfazer, aprendizado de categoria, consultas pelo banco, cota; motor por canal pronto p/ Fase 6
- [ ] Fase 6 — WhatsApp Cloud API + Telegram (adapters)
- [ ] Fase 7 — Importação CSV/OFX + leitura de prints
- [ ] Fase 8 — PWA completo (service worker), CSP, retenção do audit_log, deploy final

## Pendências conhecidas
- iOS Simulator/iPhone físico ainda não validados (emulação WebKit cobre layout; ver ADR-0012).
- Meta com imagem própria (upload): adiado; hoje ícone + cor.
- IA real medida (17/11/2026): Gemini sozinho 94% de precisão nas respostas, mas instável no gratuito (p95 13 s,
  503) → timeout por provedor (Gemini 6 s, Groq 5 s). Groq: 80% caso inteiro (reserva). Valor da IA que não está
  escrito na mensagem é descartado (`dropInventedAmounts`). Holdout cego do parser local: 77,5%.
- Novo vocabulário do assistente: adicionar ao `eval/dataset.ts` ANTES de mexer no parser (e manter o HOLDOUT intocado).
- Lighthouse "simulado" dá LCP ~4 s (modelo pessimista); com throttling real 2,3 s.
- `audit_log` sem retenção (Fase 8).
