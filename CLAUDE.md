# Lar+ ("Lar Mais") — finanças da casa e da família

@AGENTS.md

## Visão
App privado (casal → família) para controlar receitas, despesas, cartões, metas e lançar gastos por
mensagem (**só Telegram** — WhatsApp fora por custo, ADR-0021) com texto, foto e áudio + IA.
Marca **Lar+**; identificadores técnicos `larmais`. Produção: **https://larmais.tech** (EasyPanel/Docker na VPS do
dono, ADR-0020); bot **@LarMaisBot**. Supabase de produção: **o dono aplica** (nunca execute nada contra produção). **Custo zero** é requisito: avise antes de qualquer coisa paga.
O usuário é dev júnior: explique decisões e liste passos manuais. Textos de UI e docs em **pt-BR**.
Uso principal no **iPhone** → todo trabalho de UI é validado em iPhone 15, iPhone SE e Android 360×800.

Repositório: https://github.com/NycollasMartins/Dashboard_Financas (**privado**). CI: 2.000 min/mês no Free.
Deploy: EasyPanel faz build do `Dockerfile` a cada push na `main` (roteiro completo em `docs/setup-manual.md`).

## Stack
Next.js 16.4 (App Router, Turbopack, **Cache Components + Partial Prefetching**) · React 19.3 · TypeScript 5.9 ·
Tailwind 4.3 · shadcn/ui `base-nova` (**Base UI**, não Radix: `render={<X/>}` em vez de `asChild`) ·
Supabase (Postgres 17, Auth, RLS, **pg_cron**, **pg_net**, Vault) · Zod 4 · Vitest 5 · pgTAP · Playwright 1.65 (WebKit) ·
Docker (`output: standalone`) · Telegram Bot API · web-push (VAPID) · qrcode.

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
- **Telegram (Fase 6, ADR-0021)**: `src/lib/telegram/` só traduz update ↔ `handleAssistant`. Webhook
  (`webhook.ts`): secret_token em tempo constante → `telegram_updates` (idempotência por `update_id`) → 200 →
  `after()`. Grava com a **sessão do usuário dono do chat** (`session.ts`: generateLink+verifyOtp em memória);
  a secret key só acha o vínculo/idempotência/anti-flood. Só chat privado; um chat por usuário.
- **Fotos/áudio (ADR-0022)**: `ChatInput` `image`/`audio` no motor. `media/receipt.ts` (puro: schema, `scrubPII`,
  validação, dividir por categoria). Foto SEMPRE confirma; áudio = Whisper (Groq) → mesmo fluxo do texto.
  Nada de arquivo guardado; auditoria com `input_kind` e a extração/transcrição.
- **Notificações (ADR-0023)**: geradas no banco (pg_cron 15 min + triggers), `unique(user_id, event_key)`; fila
  `notification_deliveries` → `/api/notifications/dispatch` (pg_net + `x-cron-secret`/Vault) → Web Push/Telegram,
  retentativa e dead-letter (`ops_dead_letters`). `public/sw.js` só push. iPhone: só com o app na Tela de Início.
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
src/app/(app)/assistente/  chat do assistente (canal "app": texto, foto, microfone); actions em _actions/assistant.ts
src/app/(app)/notificacoes/ central · configuracoes/canais (Telegram) · configuracoes/notificacoes (push/prefs/silêncio)
src/app/api/               health · telegram/webhook · notifications/dispatch (autenticam por segredo, fora do proxy)
src/app/(app)/_actions/    server actions finas (ledger.ts, goals.ts, assistant.ts, preferences.ts)
src/components/dashboard/  KPIs, gráficos HTML/SVG (sem lib), toolbar de filtros (router.push), insights
src/components/privacy/    PrivacyProvider + PrivacyToggle (ocultar valores)
src/components/goals/      anel, cartão, gráfico, simulador, contribution-form (guardar/retirar), celebração
src/components/ledger/     entry-sheet (provider leve) + entry-form (carregado sob demanda), listas, formulários
src/components/ui/         shadcn + sheet.tsx (folha inferior no celular)
src/lib/domain/            regras puras (invoice.ts, recurrence.ts, basis.ts, projection.ts) + testes
src/lib/goals/             math.ts (puro, testado) + service.ts (API interna de metas)
src/lib/ledger/service.ts  API interna de lançamentos
src/lib/assistant/         parser local, money/dates, contrato Zod, providers/, media/, eval/ (173+40 msgs, fotos, áudios), server/ (motor)
src/lib/telegram/          adapter do bot (webhook, update, render, session, api) · src/lib/notifications/ (kinds, push, dispatch)
src/lib/analytics/         período, variação/tom, categorias, insights (puros, testados)
src/lib/data/              consultas server-only (ledger.ts, analytics.ts)
supabase/migrations/       0001 núcleo · … · 0008 metas+projeção · 0009 assistente · 0010 Telegram+mídia+notificações
supabase/tests/database/   pgTAP (251 asserções)   ·   supabase/seed.sql: ana/bruno/caio + 12 meses de demonstração
e2e/                       Playwright: auth, conta, lançamentos, iOS, canais, notificações, smoke (produção), screenshots
scripts/                   dev-lan · brand (marca Lar+) · telegram (webhook) · vapid · generate-media-eval (fotos/áudios sintéticos)
public/                    brand/ (logos, foto do bot) · icons/ · splash/ (iPhone) · sw.js (push)
Dockerfile                 multi-stage, sem root, HEALTHCHECK /api/health
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
- Segredos só em `.env.local`/EasyPanel; arquivo que lê segredo começa com `import "server-only"`. Nunca peça token/chave no chat.
- Rotas `/api/*` não passam pelo `proxy.ts`; autenticam por segredo comparado com `safeEqual` (tempo constante).
- Secret key (`createAdminClient`) **nunca** grava dado financeiro: use `createUserClient(userId)` (Telegram).
- Logs sem conteúdo de mensagem/valores; imagens e áudios nunca são persistidos; nada de CPF/CNPJ extraído.
- Marca: desenhos em `scripts/brand-mark.mjs` (rode `pnpm brand`); o `LogoMark` repete os caminhos com tokens.
- CSP sem nonce (PPR, ADR-0020): não use `dangerouslySetInnerHTML` com dado do usuário.
- Commits pequenos, **Conventional Commits em pt-BR** (`feat(escopo): …`); push ao fim de cada etapa com
  testes passando; **nunca force push na main**.

## Comandos
| Comando | O quê |
|---|---|
| `pnpm dev` / `pnpm dev:lan` | Servidor local / acessível no celular pelo Wi-Fi |
| `pnpm check` | typecheck + lint + Vitest + pgTAP + integração (precisa do db:start) |
| `pnpm test:integration` | Assistente e webhook do Telegram → banco (Supabase local; Telegram simulado) |
| `pnpm test:smoke` | Smoke contra produção (`E2E_BASE_URL=https://larmais.tech`, `SMOKE_EMAIL/PASSWORD`) |
| `pnpm telegram set\|delete\|info` · `pnpm vapid` · `pnpm brand` | Webhook do bot · chaves VAPID · identidade visual |
| `pnpm eval:assistant` | Acurácia do parser local; `EVAL_PROVIDER=gemini\|groq` (texto) e `EVAL_MEDIA=photos\|audio` + caminho `src/lib/assistant/eval/media.eval.ts` (IA real, gasta cota) |
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
- [x] **Fase 6** — Lar+ (marca), produção EasyPanel/Docker + CSP, Telegram (@LarMaisBot), fotos e áudio (Telegram e
      app), notificações (push/Telegram/central), smoke test; IA real medida (texto, fotos 100% sintético, áudio 92%)
- [ ] Fase 7 — Importação CSV/OFX
- [ ] Fase 8 — PWA offline, revisão da CSP (SRI), retenção do audit_log, backups

## Pendências conhecidas
- Push em iPhone real, bot de produção e Supabase de produção: dependem do dono (roteiro em `docs/setup-manual.md`).
- Fotos/áudios medidos com dados sintéticos; medir com cupons/vozes reais. Groq gpt-oss-20b: 200 mil tokens/dia.
- Para testar o webhook localmente use um **bot de desenvolvimento** (um bot só tem um webhook) + Cloudflare Tunnel.
- iOS Simulator/iPhone físico ainda não validados (emulação WebKit cobre layout; ver ADR-0012).
- Meta com imagem própria (upload): adiado; hoje ícone + cor.
- IA real medida (17/11/2026): Gemini sozinho 94% de precisão nas respostas, mas instável no gratuito (p95 13 s,
  503) → timeout por provedor (Gemini 6 s, Groq 5 s). Groq: 80% caso inteiro (reserva). Valor da IA que não está
  escrito na mensagem é descartado (`dropInventedAmounts`). Holdout cego do parser local: 77,5%.
- Novo vocabulário do assistente: adicionar ao `eval/dataset.ts` ANTES de mexer no parser (e manter o HOLDOUT intocado).
- Lighthouse "simulado" dá LCP ~4 s (modelo pessimista); com throttling real 2,3 s.
- `audit_log` sem retenção (Fase 8).
