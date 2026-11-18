<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/larmais-logo-dark.svg">
    <img src="public/brand/larmais-logo-light.svg" alt="Lar+" width="220">
  </picture>
</p>

# Lar+ · finanças da casa e da família

> Lê-se **"Lar Mais"**. Produção: [larmais.tech](https://larmais.tech) · bot: [@LarMaisBot](https://t.me/LarMaisBot)

[![CI](https://github.com/NycollasMartins/Dashboard_Financas/actions/workflows/ci.yml/badge.svg)](https://github.com/NycollasMartins/Dashboard_Financas/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16.4-000?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19.3-149eca?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%2017%20%2B%20RLS-3ecf8e?logo=supabase&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4.3-38bdf8?logo=tailwindcss&logoColor=white)
![Status](https://img.shields.io/badge/status-Fase%206%20conclu%C3%ADda-5eead4)
![Licença](https://img.shields.io/badge/licen%C3%A7a-todos%20os%20direitos%20reservados-lightgrey)

Controle de receitas, despesas, cartões de crédito, faturas, parcelamentos, contas fixas e **metas** — para uma
pessoa ou para a família inteira, com os dados de cada um **isolados no banco de dados**. Pensado para
o celular (lançar um gasto leva 3 toques) e com **custo zero** de infraestrutura.

| Desktop | iPhone |
|---|---|
| ![Painel no desktop](docs/images/desktop-painel.png) | ![Painel no iPhone](docs/images/iphone-painel.png) |
| ![Meta no desktop](docs/images/desktop-meta.png) | ![Metas no iPhone](docs/images/iphone-metas.png) |
| ![Lançamentos no desktop](docs/images/desktop-lancamentos.png) | ![Lançamentos no iPhone](docs/images/iphone-lancamentos.png) |
| ![Fatura no desktop](docs/images/desktop-fatura.png) | ![Lançamento rápido no iPhone](docs/images/iphone-lancamento-rapido.png) |

<details>
<summary>Mais telas</summary>

| Tela | Desktop | iPhone |
|---|---|---|
| Painel | ![](docs/images/desktop-painel.png) | ![](docs/images/iphone-painel.png) |
| Painel (visão caixa, ano) | ![](docs/images/desktop-painel-caixa.png) | ![](docs/images/iphone-painel-caixa.png) |
| Metas | ![](docs/images/desktop-metas.png) | ![](docs/images/iphone-metas.png) |
| Meta (detalhe + simulador) | ![](docs/images/desktop-meta.png) | ![](docs/images/iphone-meta.png) |
| Planejamento | ![](docs/images/desktop-planejamento.png) | ![](docs/images/iphone-planejamento.png) |
| Assistente | ![](docs/images/desktop-assistente.png) | ![](docs/images/iphone-assistente.png) |
| Guardar para meta | ![](docs/images/desktop-guardar-meta.png) | ![](docs/images/iphone-guardar-meta.png) |
| Cartões | ![](docs/images/desktop-cartoes.png) | ![](docs/images/iphone-cartoes.png) |
| Fatura | ![](docs/images/desktop-fatura.png) | ![](docs/images/iphone-fatura.png) |
| Contas | ![](docs/images/desktop-contas.png) | ![](docs/images/iphone-contas.png) |
| Recorrências | ![](docs/images/desktop-recorrencias.png) | ![](docs/images/iphone-recorrencias.png) |
| Família | ![](docs/images/desktop-familia.png) | ![](docs/images/iphone-familia.png) |
| Lançamento rápido | ![](docs/images/desktop-lancamento-rapido.png) | ![](docs/images/iphone-lancamento-rapido.png) |

As imagens são geradas automaticamente com `pnpm screenshots` a partir dos dados de demonstração.
</details>

---

## Índice

1. [Visão geral](#1-visão-geral)
2. [Funcionalidades](#2-funcionalidades)
3. [Stack e por que cada peça](#3-stack-e-por-que-cada-peça)
4. [Arquitetura](#4-arquitetura)
5. [Modelo de dados](#5-modelo-de-dados)
6. [Segurança](#6-segurança)
7. [Estrutura de pastas](#7-estrutura-de-pastas)
8. [Pré-requisitos e instalação (Windows, macOS, Linux)](#8-pré-requisitos-e-instalação)
9. [Variáveis de ambiente](#9-variáveis-de-ambiente)
10. [Rodando localmente e scripts](#10-rodando-localmente-e-scripts)
11. [Banco de dados: migrations, seed, reset e testes de RLS](#11-banco-de-dados)
12. [Testes (unitários, banco, E2E e iPhone/iOS)](#12-testes)
13. [Testar no iPhone (simulador e aparelho real)](#13-testar-no-iphone)
14. [Deploy (EasyPanel, Supabase, Telegram)](#14-deploy)
15. [Regras de negócio em linguagem simples](#15-regras-de-negócio-em-linguagem-simples)
16. [Convenções, commits, branches e como contribuir](#16-convenções-e-como-contribuir)
17. [Solução de problemas](#17-solução-de-problemas)
18. [Roadmap, limitações, custos, changelog e licença](#18-roadmap-limitações-custos-changelog-e-licença)

---

## 1. Visão geral

**Objetivo:** dar a uma família uma visão clara e confiável do dinheiro — o que entrou, o que saiu, quanto
falta da fatura, quanto sobra no mês e (em breve) quanto falta para cada meta — com o mínimo de atrito para
registrar gastos no dia a dia.

**Para quem é:** uso **pessoal e familiar, privado** (começa com um casal; depois pais e irmão).
Cada pessoa tem um **espaço individual** só dela e pode participar de um ou mais **espaços familiares**,
alternando entre eles com um toque.

**Princípios**
- **Correto antes de bonito**: dinheiro em centavos inteiros, fuso de São Paulo, regras testadas no banco.
- **Seguro por padrão**: o isolamento é garantido pelo Postgres (Row Level Security), não pela tela.
- **Celular primeiro**: tudo é validado em iPhone 15, iPhone SE e Android 360×800.
- **Custo zero**: só planos gratuitos (Supabase Free, Brevo, Telegram, Gemini/Groq gratuitos) + a VPS que você já tem (EasyPanel).

## 2. Funcionalidades

### ✅ Implementado

**Contas e acesso (Fase 1)**
- ✅ Cadastro com confirmação de e-mail, login, recuperação de senha (e-mails em pt-BR).
- ✅ Espaço individual automático + criação de famílias + convite por link (enviado por WhatsApp, sem custo).
- ✅ Papéis dono/admin/membro; alternância de espaço salva no perfil (vale em qualquer aparelho).
- ✅ Troca de e-mail com confirmação **nos dois endereços**; transferência de posse da família;
  **exclusão de conta** com bloqueio para dono de família com membros e anonimização dos dados compartilhados.
- ✅ Tema escuro (padrão) e claro; layout responsivo com barra inferior no celular; ícones/manifest para
  "Adicionar à Tela de Início".

**Dinheiro do dia a dia (Fase 2)**
- ✅ **Lançamento rápido em 3 toques**: `+` → digitar valor (teclado numérico) → categoria → **Salvar**.
  Padrões inteligentes (data de hoje, último meio de pagamento/conta/cartão). Atalho **N** no desktop.
- ✅ Receitas, despesas e **transferências** entre contas (que não contam como gasto).
- ✅ Lista de lançamentos agrupada por dia com total diário, busca e filtros (mês, tipo, categoria, membro,
  conta, cartão) guardados na URL; editar, excluir e **desfazer**.
- ✅ Categorias padrão em português (22) + personalizadas, com ícone, cor e **subcategorias**; categoria em
  uso só é excluída movendo os lançamentos para outra.
- ✅ Contas/carteiras com **saldo calculado** (nunca digitado) e valor "previsto" separado.
- ✅ Cartões com limite, fechamento e vencimento; **limite disponível calculado**.
- ✅ **Faturas automáticas** (compra no dia do fechamento vai para a próxima), status aberta/fechada/vencida/paga,
  itens, e **registro de pagamento** (total ou parcial) que não duplica a despesa.
- ✅ **Parcelamento** em até 48x com arredondamento exato; editar/excluir "só esta", "esta e as próximas" ou "todas".
- ✅ **Recorrências** semanais, mensais e anuais (salário, aluguel, assinaturas) geradas automaticamente todos os
  dias pelo banco (pg_cron), como "previstas" ou já confirmadas; editar "daqui pra frente".
- ✅ Trilha de auditoria (quem criou/alterou/excluiu e quando).
- ✅ Dados de demonstração realistas no ambiente local.

**Painel e análises (Fase 3)**
- ✅ **KPIs** do período (receitas, despesas, saldo, taxa de economia) com variação vs. período anterior —
  seta, % e cor que *significa* algo: gasto subindo é ruim, receita subindo é boa.
- ✅ **Saldo projetado para o fim do mês** = saldo de hoje + receitas previstas − despesas previstas −
  faturas a vencer; posição atual (saldo das contas, faturas em aberto, limite disponível).
- ✅ Duas visões: **Competência** (gasto no mês da compra) e **Caixa** (compra no cartão no mês em que a
  fatura vence) — ver [seção 15](#15-regras-de-negócio-em-linguagem-simples).
- ✅ **Realizado × previsto** sempre separados (recorrências previstas, parcelas futuras, faturas a vencer).
- ✅ Gráficos: gastos por categoria/subcategoria (toque → lançamentos filtrados), evolução de 12 meses,
  comparação com a média de 3 meses, uso do limite dos cartões; listas de próximos vencimentos (15 dias),
  maiores gastos, gastos por membro e por cartão/conta.
- ✅ **Insights** em texto por regras (ex.: "Você gastou 40% a mais em Restaurantes que a média dos últimos 3 meses").
- ✅ Filtros na URL (mês, ano, intervalo, visão, categoria, membro, conta, cartão): link compartilhável e
  botão voltar funcionando.
- ✅ **Ocultar valores** (ícone de olho) para usar em público, salvo no perfil.
- ✅ Acessível: cada gráfico vira tabela com um toque; Lighthouse acessibilidade 100.
- ✅ Seed com **12 meses** de histórico (freelas, 13º, um mês atípico) e um 2º membro na família.

**Metas e projeções (Fase 4)**
- ✅ **Metas** individuais ou da família (com quem guardou quanto): valor-alvo, prazo opcional, prioridade,
  valor já guardado, conta de reserva ("caixinha"), rendimento estimado, pausar/arquivar; concluída sozinha ao
  atingir o alvo, com uma celebração.
- ✅ **Guardar em 3 toques** (+ → "Guardar para meta" → valor → Guardar) e **retirar com motivo**; histórico completo.
- ✅ **Guardar não é despesa**: o dinheiro sai da conta e vai para a reserva da meta; o painel mostra
  "Guardado em metas" separado e a taxa de economia diz quanto foi para metas.
- ✅ **Aporte planejado** ("R$ 500 todo dia 5") que aparece como previsto e você confirma.
- ✅ Quanto falta, **quanto guardar por mês para o prazo** (recalculado a cada aporte), **quando você chega no
  ritmo atual** (média ponderada dos últimos meses) e se está adiantado, no ritmo ou atrasado.
- ✅ **Simulador "e se"** (aporte, prazo, alvo, rendimento) e "reduzindo X% em Restaurantes você antecipa N meses".
- ✅ **Planejamento**: sobra mensal realista, quanto já está comprometido, alerta quando as metas não cabem na
  renda e sugestão de como dividir a sobra.
- ✅ **Projeção de até 36 meses** a partir das regras (recorrências, parcelas, faturas) — sem gravar nada.
- ✅ Lista de lançamentos na **visão caixa** (compras pelo vencimento da fatura) e com as projeções dos meses
  futuros: soma exatamente o que o painel mostra.

**Assistente que entende mensagens (Fase 5)**
- ✅ Tela **Assistente** (e atalho no botão +): escreva "gastei 50 no uber", "comprei uma TV de 3000 em 10x no
  nubank", "guardei 300 pra viagem", "paguei o aluguel", "quanto gastei com mercado?", "desfazer".
- ✅ Despesa, receita, compra parcelada, transferência, guardar/retirar de meta, confirmar previsto, consultas
  (gastos, receitas, saldo, fatura, meta, quanto falta guardar, resumo), desfazer e ajuda; vários lançamentos numa mensagem.
- ✅ Valores como "50 conto", "1k", "mil e duzentos"; datas como "ontem", "sexta passada", "dia 5".
- ✅ Pergunta quando falta algo ou há dúvida (ex.: cartão Nubank ou Conta Nubank?), com opções.
- ✅ Grava direto o que é simples e seguro (com **Desfazer**); pede confirmação com cartão editável no resto.
- ✅ **Aprende**: corrigiu a categoria de "padaria do zé"? Na próxima já vem certa.
- ✅ Funciona **sem IA** (parser local) e usa Gemini/Groq só nas mensagens difíceis — veja [o que é enviado](#assistente-o-que-vai-para-a-ia).

**Lar+ no Telegram, fotos, áudio e notificações (Fase 6)**
- ✅ **@LarMaisBot**: o mesmo assistente pelo Telegram — texto, **foto de cupom/nota/print** e **áudio**. Botões para
  confirmar/editar/cancelar, desfazer, `/resumo`, `/espaco` ("usar família"/"usar individual"); toda resposta diz onde gravou.
- ✅ Vincular em **Configurações → Canais**: código de uso único (10 min) + **QR code** + link direto; um chat por pessoa.
- ✅ **Fotos** (também no Assistente do app — no iPhone abre a câmera): lê estabelecimento, total, data, pagamento, final
  do cartão e itens; alerta soma × total, data estranha e possível duplicata; **sempre confirma**; **dividir por categoria**
  (ex.: mercado + farmácia na mesma nota). Não lê nem guarda CPF/CNPJ; a imagem é descartada.
- ✅ **Áudio** (Telegram e botão de microfone no app, até 60 s): "Entendi: '…'" e segue o fluxo normal.
- ✅ **Notificações**: push no iPhone/Android (PWA), Telegram e **central no app** (sino com não lidas). Contas vencendo
  amanhã, fatura fechando/vencendo, resumo semanal, meta atingida, aporte do dia, gasto acima da média, lançamento de
  outro membro (opcional) — cada uma liga/desliga por canal, com **horário de silêncio**.
- ✅ Produção: **Docker/EasyPanel** em [larmais.tech](https://larmais.tech), CSP/HSTS, healthcheck e smoke test.

### 🔜 Planejado (ver [roadmap](docs/roadmap.md))
- 🔜 **Fase 7** – Importação de extratos CSV/OFX.
- 🔜 **Fase 8** – PWA offline, retenção da auditoria, backups, revisão final de segurança.

## 3. Stack e por que cada peça

| Tecnologia | Versão | Para quê / por quê | Decisão |
|---|---|---|---|
| Node.js | 24 | Runtime do Next.js e das ferramentas | — |
| pnpm | 9.12 | Instalação rápida e determinística | — |
| **Next.js** (App Router, Turbopack, `output: standalone`) | 16.4.6 | Front e back no mesmo projeto: Server Components, Server Actions, Route Handlers (webhook do Telegram, notificações) | [ADR-0001](docs/adr/0001-stack.md), [ADR-0008](docs/adr/0008-cache-components-e-sessao.md) |
| React | 19.3 | UI; `useActionState` nos formulários | — |
| TypeScript | 5.9 | Tipagem ponta a ponta (tipos do banco gerados) | — |
| Tailwind CSS | 4.3 | Estilo com tokens do design system | [design system](docs/design-system.md) |
| shadcn/ui (`base-nova`) + Base UI | 4.23 / 1.9 | Componentes acessíveis copiados para o repo | ADR-0001 |
| **Supabase** (Postgres 17, Auth, RLS, pg_cron) | CLI 2.117 | Banco relacional de verdade + login + isolamento no banco + jobs agendados, no plano gratuito | [ADR-0002](docs/adr/0002-multitenancy-workspaces-rls.md), [ADR-0011](docs/adr/0011-recorrencias-pg-cron.md) |
| @supabase/ssr / supabase-js | 0.12.7 / 2.119 | Sessão em cookies no servidor | ADR-0008 |
| Zod | 4.6 | Validação dos formulários e das Server Actions | — |
| Vitest | 5.1 | Testes das regras puras (fatura, parcelas, recorrência, dinheiro, datas) | — |
| pgTAP | — | Testes de RLS e regras **dentro** do Postgres | ADR-0002 |
| Playwright (+ MCP) | 1.65 | E2E em WebKit (Safari) com iPhone 15/SE, Android e desktop | [ADR-0012](docs/adr/0012-testes-mobile-ios.md) |
| next-themes, sonner, lucide-react | — | Tema, toasts, ícones | — |
| **Docker + EasyPanel** (VPS própria) | Node 24 alpine | Hospedagem em `larmais.tech`, HTTPS Let's Encrypt, deploy a cada push | [ADR-0020](docs/adr/0020-producao-easypanel-docker.md) |
| Telegram Bot API | — | Canal de mensagens gratuito (@LarMaisBot) | [ADR-0021](docs/adr/0021-telegram-unico-canal.md) |
| Gemini 3.1 Flash-Lite · Groq (gpt-oss-20b, Whisper large-v3) | — | IA só interpreta: texto difícil, leitura de fotos, transcrição de áudio (gratuitos) | [ADR-0018](docs/adr/0018-ia-so-interpreta.md), [ADR-0022](docs/adr/0022-fotos-e-audio.md) |
| web-push (VAPID) · qrcode | 3.6 · 1.5 | Notificações push padrão · QR da vinculação | [ADR-0023](docs/adr/0023-notificacoes.md) |
| Brevo (SMTP) | — | E-mails do Auth em produção, gratuito | [ADR-0007](docs/adr/0007-convites-e-emails.md) |

Todas as decisões estão em [`docs/adr/`](docs/adr/README.md).

## 4. Arquitetura

```mermaid
flowchart LR
    subgraph Cliente["iPhone / Android / navegador (PWA Lar+)"]
        UI["React 19<br/>Server + Client Components"]
        SW["sw.js<br/>(push + clique)"]
    end
    TGU["Telegram<br/>(@LarMaisBot)"]

    subgraph VPS["VPS · EasyPanel · Docker (larmais.tech)"]
        PX["proxy.ts<br/>(renova sessão)"]
        RSC["Server Components<br/>(leitura com RLS)"]
        SA["Server Actions<br/>(Zod → APIs internas)"]
        ENG["Motor do assistente<br/>handleAssistant (todos os canais)"]
        WH["/api/telegram/webhook<br/>(secret_token, idempotência)"]
        DS["/api/notifications/dispatch<br/>(x-cron-secret)"]
    end

    subgraph Supabase["Supabase (plano Free)"]
        AUTH["Auth"]
        PG[("Postgres 17 · RLS<br/>views calculadas · audit_log<br/>fila de notificações")]
        CRON["pg_cron + pg_net<br/>recorrências · notificações (15 min)"]
    end

    AI["Gemini (texto/fotos)<br/>Groq (texto/Whisper)"]
    SMTP["Brevo SMTP<br/>@larmais.tech"]
    PUSH["Serviços de push<br/>(Apple / Google / Mozilla)"]

    UI -->|HTTPS| PX --> RSC
    UI --> SA --> ENG
    RSC & SA & ENG -->|sessão do usuário| PG
    TGU -->|webhook| WH --> ENG
    ENG -->|só texto/nomes · imagem/áudio descartados| AI
    SA --> AUTH --> SMTP
    CRON --> PG
    CRON -->|pg_net| DS --> PUSH --> SW
    DS --> TGU
```

**Telegram → banco** (o bot grava como a própria pessoa — RLS e auditoria iguais ao app; ADR-0021)
```mermaid
sequenceDiagram
    participant T as Telegram
    participant W as Webhook
    participant DB as Supabase
    participant M as Motor (handleAssistant)
    T->>W: update (header secret_token)
    W->>W: segredo confere? (tempo constante) senão 401
    W->>DB: insert telegram_updates(update_id) — duplicado? → 200 e para
    W-->>T: 200 imediato
    W->>DB: vínculo do chat (channel_links) — não vinculado? → só instrução
    W->>DB: abre a SESSÃO do usuário (magiclink interno, em memória)
    W->>M: texto / foto / áudio / botão
    M->>DB: APIs internas (RLS) + assistant_actions (origem + mensagem)
    M-->>W: respostas estruturadas
    W->>T: mensagem com botões (edita a mensagem após confirmar)
```

**Foto/áudio → IA → confirmação** (a IA só extrai/transcreve; o sistema valida; ADR-0022)
```mermaid
flowchart LR
    F["📷 foto (≤1600 px)"] --> G["Gemini extrai JSON<br/>(sem CPF/CNPJ)"] --> V["Validação no sistema<br/>soma×total · data · valor>0 · duplicata · cartão pelo final"]
    V --> C{"Cartão de confirmação<br/>(SEMPRE)"}
    C -->|um gasto| S["Gravar"]
    C -->|dividir por categoria| S
    C -->|editar / cancelar| X["…"]
    A["🎤 áudio ≤60 s"] --> W["Whisper (Groq)<br/>reserva: Gemini"] --> E["“Entendi: …”"] --> P["Mesmo fluxo do texto<br/>(parser local → IA → regras de confirmação)"] --> S
```

**Notificações** (idempotentes, com silêncio e retentativas; ADR-0023)
```mermaid
flowchart LR
    CR["pg_cron 15 min"] --> GEN["generate_notifications<br/>(contas, faturas, metas, resumo…)"]
    TRG["triggers<br/>(meta atingida, outro membro)"] --> N
    GEN --> N[("notifications<br/>unique(user, event_key)")]
    N --> CEN["Central no app 🔔"]
    N --> Q[("notification_deliveries<br/>push · telegram")]
    CR -->|pg_net + segredo do Vault| D["/api/notifications/dispatch"]
    Q -->|claim SKIP LOCKED<br/>fora do silêncio| D
    D --> PU["Web Push (VAPID)"] & TG["Telegram"]
    D -->|erro: 1 min→5→30→2 h<br/>5 falhas = dead-letter| Q
```

**Conceito central: workspace (espaço).** Todo dado financeiro pertence a um *workspace*:

- **Individual** (`personal`): criado no cadastro, só você participa, nunca recebe convites.
- **Família** (`household`): criado por alguém (o **dono**), que convida membros por link.
  Todos os membros veem os mesmos lançamentos, cartões e contas.

A mesma tela serve aos dois; o seletor no topo troca o espaço ativo (salvo no seu perfil). O banco garante
que você só enxerga espaços dos quais participa.

**Fluxo de um lançamento:** a folha de lançamento (client) envia um `FormData` → Server Action valida com Zod
→ chama o Supabase **com a sua sessão** → o Postgres aplica RLS, triggers (autor, fatura do cartão,
auditoria) → `revalidatePath` atualiza as telas.

## 5. Modelo de dados

Diagrama completo e explicação de cada coluna em [`docs/modelo-de-dados.md`](docs/modelo-de-dados.md).

```mermaid
erDiagram
    WORKSPACES ||--o{ WORKSPACE_MEMBERS : "membros"
    WORKSPACES ||--o{ WORKSPACE_INVITES : "convites"
    WORKSPACES ||--o{ ACCOUNTS : ""
    WORKSPACES ||--o{ CREDIT_CARDS : ""
    WORKSPACES ||--o{ CATEGORIES : ""
    WORKSPACES ||--o{ TRANSACTIONS : ""
    WORKSPACES ||--o{ RECURRENCES : ""
    WORKSPACES ||--o{ TRANSFERS : ""
    CREDIT_CARDS ||--o{ CARD_INVOICES : "faturas"
    CARD_INVOICES ||--o{ INVOICE_PAYMENTS : "pagamentos"
    CARD_INVOICES |o--o{ TRANSACTIONS : "itens"
    INSTALLMENT_PLANS |o--o{ TRANSACTIONS : "parcelas"
    RECURRENCES |o--o{ TRANSACTIONS : "geradas"
    CATEGORIES |o--o{ TRANSACTIONS : ""
    CATEGORIES |o--o{ CATEGORIES : "subcategoria"
    ACCOUNTS ||--o{ TRANSFERS : "origem/destino"
    WORKSPACES ||--o{ GOALS : "Fase 4"
    GOALS ||--o{ GOAL_CONTRIBUTIONS : "aportes"
```

| Tabela | O que guarda |
|---|---|
| `profiles` | Nome e último espaço ativo de cada usuário. |
| `workspaces` / `workspace_members` | Espaços (individual/família) e quem participa com qual papel. |
| `workspace_invites` | Convites de uso único (só o **hash** do token é salvo). |
| `accounts` | Contas e carteiras (o saldo é calculado na view `account_balances`). |
| `credit_cards` / `card_invoices` | Cartões e faturas (total/status calculados em `card_invoice_summaries`). |
| `transactions` | Receitas e despesas, à vista, no crédito, parceladas ou geradas por recorrência. |
| `installment_plans` | A compra parcelada "mãe" de N parcelas. |
| `recurrences` | Receitas e despesas fixas (semanal/mensal/anual). |
| `transfers` | Transferências entre contas (não são receita nem despesa). |
| `invoice_payments` | Pagamentos de fatura (saem da conta; não são despesa). |
| `categories` | Categorias e subcategorias por espaço. |
| `audit_log` | Quem criou/alterou/excluiu o quê e quando. |
| `goals`, `goal_contributions` | Metas e aportes/retiradas (Fase 4); aporte planejado = `recurrences.goal_id`; resumo calculado em `goal_summaries`. |
| `channel_links`, `channel_link_codes`, `telegram_updates` | Vínculo do Telegram (código de uso único, só o hash), idempotência por `update_id` (sem conteúdo). |
| `assistant_*`, `category_rules` | Histórico/estado do assistente, ações com a mensagem original (`input_kind` texto/foto/áudio), regras aprendidas, cota. |
| `notifications`, `notification_deliveries`, `notification_prefs`, `notification_settings`, `push_subscriptions` | Central, fila de envio com retentativas, preferências por tipo/canal, silêncio e aparelhos com push (Fase 6). |

## 6. Segurança

- **Row Level Security em todas as tabelas.** Políticas usam `private.my_workspace_ids()` e
  `private.is_admin()` (schema não exposto pela API). Mesmo que alguém use a API direto, só vê o que é seu.
- **Chaves estrangeiras compostas** `(id, workspace_id)`: é impossível um lançamento apontar para o cartão
  ou a categoria de outro espaço.
- **Autoria não forjável**: `created_by`/`updated_by` vêm da sessão por trigger; `workspace_id` é imutável.
- **Views com `security_invoker`**: saldos e faturas respeitam a RLS de quem consulta.
- **Operações sensíveis em funções do banco** com checagens explícitas (convites, posse, exclusão de conta).
- **Reautenticação**: trocar e-mail e excluir a conta pedem a senha atual.
- **Agregados do painel** em funções `SECURITY INVOKER`: rodam com a sessão de quem pede, então a RLS
  vale também para somas e médias — uma família nunca vê números de outra (testado).
- **Assistente**: a IA só interpreta; validação por schema, gravação pelas mesmas APIs das telas, chaves só no
  servidor, cota por usuário e rate limit (ADR-0018/0019). Detalhes logo abaixo.
- **Telegram** (ADR-0021): webhook só com o `secret_token` certo (comparação em tempo constante), idempotência por
  `update_id`, anti-flood (20/min por chat), só chat privado, chat não vinculado não recebe dado nenhum, e o bot grava
  com a **sessão do próprio usuário** (a secret key nunca toca dados financeiros).
- **Fotos e áudio** (ADR-0022): processados em memória e descartados; sem CPF/CNPJ; limites de tamanho e cotas próprias.
- **Notificações**: chave VAPID privada só no servidor; disparo protegido por segredo (Vault + `CRON_SECRET`).
- **Produção** (ADR-0020): contêiner sem root, CSP (`frame-ancestors 'none'`, `connect-src` só app + Supabase),
  HSTS preload, COOP; câmera/microfone liberados só para o próprio site.
- **Testes de isolamento**: 251 asserções pgTAP (inclui "estranho não vê nada", "membro não promove a si
  mesmo", "não dá para mover lançamento de espaço").

**Matriz de permissões**

| Ação | Dono | Admin | Membro |
|---|:---:|:---:|:---:|
| Ver tudo do espaço | ✅ | ✅ | ✅ |
| Criar lançamentos, transferências, pagamentos de fatura | ✅ | ✅ | ✅ |
| Editar/excluir lançamentos de outras pessoas | ✅ | ✅ | ❌ (só os próprios) |
| Criar/editar contas, cartões, categorias, recorrências | ✅ | ✅ | ✅ |
| Excluir contas/cartões/categorias/recorrências de outros | ✅ | ✅ | ❌ |
| Convidar, revogar convites, mudar papéis, remover membros | ✅ | ✅ | ❌ |
| Renomear a família | ✅ | ✅ | ❌ |
| Sair da família | ❌ (transfira a posse) | ✅ | ✅ |
| Transferir a posse / excluir a família | ✅ | ❌ | ❌ |

**Segredos:** só em `.env.local` (ignorado pelo git) e nas variáveis do EasyPanel. Apenas `.env.example`
(sem valores reais) é versionado. Variáveis `NEXT_PUBLIC_*` vão para o navegador — **nunca** coloque
segredos nelas. Arquivos que leem segredos começam com `import "server-only"`. Headers de segurança
(HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) em `next.config.ts`.

### Assistente: o que vai para a IA

> **Aviso de privacidade.** A maioria das mensagens é entendida **dentro do app** (parser local), sem enviar nada
> para fora. Só quando o app não tem certeza ele pergunta ao Google Gemini (ou ao Groq, se o Gemini falhar).
> **No plano gratuito do Gemini, o Google pode usar o texto enviado para melhorar os produtos, e pessoas podem
> revisá-lo.** Não escreva dados sensíveis (senhas, números de cartão) no assistente.

| Enviado ao provedor | **Nunca** enviado |
|---|---|
| O texto da mensagem (até 500 caracteres) | Saldos, valores do histórico, faturas |
| Data e hora atuais (São Paulo) | E-mails, nomes de pessoas da família |
| **Nomes** das categorias, contas, cartões e metas do espaço | Ids, tokens, chaves, qualquer outro dado |

- As respostas de consulta ("quanto gastei com mercado?") são **calculadas pelo banco do app** e escritas por
  modelo de texto do sistema — a IA só identifica a pergunta.
- Tudo é montado num único lugar (`src/lib/assistant/prompt.ts#buildUserPayload`), fácil de auditar.
- Sem chaves configuradas (ou com `ASSISTANT_AI_ENABLED=false`), **nada** sai do app.
- O histórico do chat é seu (ninguém da família vê) e pode ser apagado na própria tela.

**Fotos e áudios (Fase 6).** A **imagem** vai para o **Google Gemini** e o **áudio** para o **Groq** (Whisper) — só para
ler o comprovante ou transcrever o que você falou. O arquivo **não é guardado** em lugar nenhum (nem no banco, nem em
disco, nem em log): fica só o lançamento com "origem: foto/áudio" e, na auditoria, o **resumo lido** ou a
**transcrição**. Não extraímos nem gravamos CPF/CNPJ, telefone, e-mail ou chave Pix que apareçam no comprovante.
No gratuito, o Google pode usar as imagens enviadas para melhorar os produtos — **evite fotografar documentos**.
Pelo Telegram, as mensagens também passam pelos servidores do Telegram (como qualquer conversa no app).

## 7. Estrutura de pastas

```
.
├── .github/workflows/ci.yml   # CI: typecheck, lint, Vitest, pgTAP, integração, E2E e imagem Docker
├── Dockerfile, .dockerignore  # Imagem de produção (standalone, sem root, healthcheck)
├── .mcp.json                  # Playwright MCP (WebKit + iPhone) para o Claude Code
├── docs/                      # Documentação
│   ├── adr/                   #   Decisões de arquitetura (0001–0023)
│   ├── images/                #   Screenshots do README (gerados por `pnpm screenshots`)
│   ├── requisitos.md          #   Requisitos e regras de negócio (RN-xx)
│   ├── modelo-de-dados.md     #   Diagrama ER e RLS
│   ├── design-system.md       #   Cores, tipografia, componentes
│   ├── roadmap.md             #   Fases
│   └── setup-manual.md        #   Passos manuais (contas, chaves, deploy)
├── e2e/                       # Playwright (auth, conta, lançamentos, iOS, canais, notificações, smoke, screenshots)
├── public/                    # brand/ (logo Lar+, foto do bot), icons/ (PWA), splash/ (iPhone), sw.js (push)
├── scripts/                   # dev-lan, brand (marca), telegram (webhook), vapid, generate-media-eval
├── src/
│   ├── app/
│   │   ├── (auth)/            # Telas públicas: entrar, cadastro, senha, convite
│   │   ├── (app)/             # Telas logadas: painel, lançamentos, cartões, contas, recorrências,
│   │   │   │                  #   categorias, família, configurações, mais
│   │   │   ├── painel/        #   Dashboard (blocos com Suspense + load.ts com cache)
│   │   │   ├── metas/         #   Metas e detalhe (/metas/[id]); planejamento/ = sobra e distribuição
│   │   │   ├── assistente/    #   Chat do assistente (canal "app": texto, foto, áudio)
│   │   │   ├── notificacoes/  #   Central de notificações
│   │   │   ├── configuracoes/ #   canais/ (Telegram) e notificacoes/ (push, preferências, silêncio)
│   │   │   └── _actions/      #   Server Actions (lançamentos, metas, assistente, canais, notificações)
│   │   ├── api/               # health · telegram/webhook · notifications/dispatch
│   │   ├── auth/confirm/      # Destino dos links de e-mail (token_hash)
│   │   ├── layout.tsx         # Fontes, tema, metadados PWA/iOS
│   │   └── manifest.ts        # Manifest do PWA
│   ├── components/
│   │   ├── app-shell/         # Sidebar, barra inferior, seletor de espaço, menu do usuário
│   │   ├── dashboard/         # KPIs, gráficos (HTML/SVG), filtros, insights, listas
│   │   ├── goals/             # Anel, cartão, gráfico, simulador, guardar/retirar, celebração
│   │   ├── assistant/         # Chat (bolhas, cartão de confirmação, opções, desfazer, câmera, microfone)
│   │   ├── notifications/     # Sino, central, ativar push (guia do iPhone), preferências
│   │   ├── privacy/           # Ocultar valores (ícone de olho)
│   │   ├── ledger/            # Lançamento rápido (formulário sob demanda), listas, formulários
│   │   ├── forms/             # Campos acessíveis e botão de envio
│   │   └── ui/                # shadcn/ui + sheet (folha inferior)
│   ├── lib/
│   │   ├── domain/            # Regras puras: fatura, recorrência, competência × caixa (+ testes)
│   │   ├── analytics/         # Período, variação, categorias, insights do painel (+ testes)
│   │   ├── goals/             # math.ts (cálculos puros) + service.ts (API interna p/ telas, IA e bot)
│   │   ├── ledger/            # service.ts — API interna de lançamentos (telas e assistente)
│   │   ├── assistant/         # parser local, contrato (Zod), provedores IA, media/ (comprovantes), avaliação; server/ = motor
│   │   ├── telegram/          # Adapter do bot: webhook, update, render (botões), sessão do usuário, API
│   │   ├── notifications/     # Tipos, Web Push (VAPID), dispatcher
│   │   ├── data/              # Consultas server-only (ledger.ts, analytics.ts)
│   │   ├── supabase/          # Clientes (servidor/proxy), tipos gerados, retry de relógio
│   │   ├── validation/        # Schemas Zod
│   │   ├── money.ts, dates.ts # Centavos e datas (America/Sao_Paulo)
│   │   └── …                  # sessão, erros, contexto do espaço
│   └── proxy.ts               # Antigo middleware: sessão + redirecionamentos
├── supabase/
│   ├── migrations/            # 0001–0009 (schema, RLS, funções, pg_cron, analytics, metas + projeção, assistente)
│   ├── tests/database/        # pgTAP
│   ├── templates/             # E-mails em pt-BR
│   ├── seed.sql               # Usuários de teste + 12 meses de demonstração (só local)
│   └── config.toml            # Supabase local
├── CLAUDE.md                  # Contexto do projeto para o Claude Code
└── playwright.config.ts       # Projetos: Desktop, iPhone 15, iPhone SE, Android 360x800
```

## 8. Pré-requisitos e instalação

| Ferramenta | Versão testada | Para quê |
|---|---|---|
| Git | 2.4x+ | Código |
| Node.js | **24.x** | Runtime |
| pnpm | **9.12** (via Corepack) | Pacotes |
| Docker Desktop / Docker Engine | 29.x | Supabase local |
| Supabase CLI | 2.117+ | Banco local, migrations, testes |
| (opcional) Xcode | 26+ | iOS Simulator (só macOS) |

### macOS
```bash
# Homebrew: https://brew.sh
brew install git node@24 supabase/tap/supabase
brew install --cask docker          # abra o Docker Desktop depois
corepack enable && corepack prepare pnpm@9.12.0 --activate
```

### Windows (recomendado: WSL2)
1. PowerShell como administrador: `wsl --install` → reinicie → abra o **Ubuntu**.
2. Instale o **Docker Desktop** e ative *Settings → Resources → WSL integration* para o Ubuntu.
3. Dentro do Ubuntu, siga os passos de **Linux** abaixo.
   *(Sem WSL: `winget install OpenJS.NodeJS Git.Git Docker.DockerDesktop` e
   `scoop install supabase` — funciona, mas scripts de shell podem exigir ajustes.)*

### Linux (Ubuntu/Debian)
```bash
# Node 24 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash && source ~/.bashrc
nvm install 24
corepack enable && corepack prepare pnpm@9.12.0 --activate
# Docker Engine: https://docs.docker.com/engine/install/ubuntu/  (e: sudo usermod -aG docker $USER)
# Supabase CLI (binário .deb): https://github.com/supabase/cli/releases
```

### Projeto
```bash
git clone https://github.com/NycollasMartins/Dashboard_Financas.git
cd Dashboard_Financas
pnpm install
pnpm exec playwright install webkit chromium   # só para os testes E2E
```

## 9. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha.

| Variável | Pública? | Para que serve | Onde obter |
|---|:---:|---|---|
| `NEXT_PUBLIC_SITE_URL` | pública (build) | URL do app (e-mails, convites, botões do Telegram) | Local: `http://localhost:3000`; produção: `https://larmais.tech` |
| `NEXT_PUBLIC_SUPABASE_URL` | pública (build) | Endereço da API do Supabase | Local: `supabase status` (API_URL); nuvem: *Project Settings → API Keys* |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | pública (build) | Chave publicável (`sb_publishable_…`); a segurança vem da RLS | Local: `supabase status`; nuvem: *API Keys* |
| `SUPABASE_SECRET_KEY` | **secreta** | Webhook do Telegram (achar o vínculo, idempotência) e disparo de notificações. **Nunca** com `NEXT_PUBLIC_` | *API Keys → Secret keys* (local: `supabase status`) |
| `GEMINI_API_KEY` / `GROQ_API_KEY` | **secretas** | IA: texto difícil, fotos (Gemini), áudio (Groq) | `docs/setup-manual.md` §E |
| `GEMINI_MODEL` / `GROQ_MODEL` / `GROQ_AUDIO_MODEL` | servidor | Padrões `gemini-3.1-flash-lite` / `openai/gpt-oss-20b` / `whisper-large-v3` | — |
| `ASSISTANT_AI_DAILY_LIMIT` / `ASSISTANT_AI_PER_MINUTE` | servidor | Cota de texto por usuário/dia/provedor (40) e por minuto (8) | — |
| `ASSISTANT_PHOTO_DAILY_LIMIT` / `ASSISTANT_AUDIO_DAILY_LIMIT` | servidor | Fotos (15) e áudios (30) por usuário/dia | — |
| `ASSISTANT_MAX_AUDIO_SECONDS` / `ASSISTANT_CONFIRM_AUDIO` | servidor | Duração máxima (60 s) · `true` = áudio sempre pede confirmação | — |
| `ASSISTANT_CONFIRM_ABOVE_CENTS` / `ASSISTANT_AI_ENABLED` | servidor | Valor que sempre confirma (R$ 1.000) · `false` desliga a IA | — |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` | **secretas** | Bot e segredo do webhook | @BotFather · `openssl rand -hex 32` (§F) |
| `TELEGRAM_BOT_USERNAME` / `TELEGRAM_WEBHOOK_URL` | servidor | `LarMaisBot` · URL do túnel só para teste local (§I) | — |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | pública (build) / **secreta** / servidor | Web Push | `pnpm vapid` (§G) |
| `CRON_SECRET` | **secreta** | pg_cron → `/api/notifications/dispatch` (mesmo valor no Vault) | `openssl rand -hex 32` (§C.7) |

## 10. Rodando localmente e scripts

```bash
# 1. Docker Desktop aberto
pnpm db:start            # sobe Postgres, Auth e Mailpit (e-mails de teste) e aplica migrations + seed
cp .env.example .env.local && supabase status   # copie a PUBLISHABLE_KEY para o .env.local
pnpm dev                 # http://localhost:3000
```

- **E-mails de teste** (confirmação, recuperação, troca de e-mail): <http://127.0.0.1:54324> (Mailpit).
- **Contas de teste** (criadas pelo `supabase/seed.sql`, **somente local**; senha `Teste12345`):

| E-mail | Situação |
|---|---|
| `ana@teste.local` | Dona da família **Casa Teste**, com um mês de dados de demonstração (salário, contas fixas, gastos, 2 cartões, notebook em 10x, celular em 6x, faturas pagas e abertas) |
| `bruno@teste.local` | Sem família — use para testar convites |

**Scripts (`package.json`)**

| Script | O que faz |
|---|---|
| `pnpm dev` | Servidor de desenvolvimento (localhost) |
| `pnpm dev:lan` | Servidor acessível pelo Wi-Fi para testar no celular; imprime o endereço |
| `pnpm build` / `pnpm start` | Build de produção / servir o build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Gera tipos de rotas e roda `tsc` |
| `pnpm test` / `pnpm test:watch` | Testes unitários (Vitest) |
| `pnpm test:db` | Testes de RLS e regras no Postgres (pgTAP) |
| `pnpm test:e2e` | E2E: desktop + iPhone 15 + iPhone SE + Android 360×800 |
| `pnpm test:e2e:ios` | E2E só nos iPhones (WebKit) |
| `pnpm test:e2e:ui` | Modo visual do Playwright |
| `pnpm screenshots` | Regera as imagens do README (`docs/images`) |
| `pnpm check` | typecheck + lint + unitários + banco + integração |
| `pnpm test:integration` | Integração: assistente e **webhook do Telegram** → banco (Supabase local, Telegram simulado) |
| `pnpm test:smoke` | Smoke test contra a produção (`E2E_BASE_URL=https://larmais.tech`, usuário de teste) |
| `pnpm eval:assistant` | Acurácia do parser local; com chaves, IA real (texto, fotos e áudios — ver §12) |
| `pnpm telegram set\|delete\|info` | Registra/remove/consulta o webhook do bot (usa as variáveis de ambiente) |
| `pnpm vapid` | Gera as chaves VAPID do Web Push |
| `pnpm brand` | Regera logo, ícones, telas de abertura e foto do bot (`scripts/brand-mark.mjs`) |
| `pnpm db:start` / `db:stop` | Liga/desliga o Supabase local |
| `pnpm db:reset` | Recria o banco (migrations + seed) |
| `pnpm db:types` | Regenera `src/lib/supabase/database.types.ts` |

## 11. Banco de dados

- **Criar uma migration**: `supabase migration new nome_curto` → edite o SQL em `supabase/migrations/`.
  Regras: toda tabela nova tem `workspace_id`, FKs compostas, RLS, trigger de auditoria e teste pgTAP.
  **Nunca edite uma migration já commitada** — crie outra.
- **Aplicar localmente**: `supabase migration up` (incremental) ou `pnpm db:reset` (do zero + seed).
- **Tipos TypeScript**: `pnpm db:types` depois de mudar o schema.
- **Seed**: `supabase/seed.sql` roda em todo `db:reset`; usa datas relativas a hoje.
- **Testes de RLS**: `pnpm test:db` (arquivos em `supabase/tests/database/*.test.sql`).
- **Lint do schema**: `supabase db lint --level warning`.
- **Produção**: `supabase link --project-ref <ref>` e `supabase db push` (o seed **não** é enviado).

## 12. Testes

| Tipo | Comando | Cobre |
|---|---|---|
| Unitários (Vitest) | `pnpm test` | Centavos (`parseBRL`, `formatBRL`, parcelas), datas em São Paulo (inclusive perto da meia-noite e na virada do ano), regra da fatura, recorrências, competência × caixa, período do painel, variação e cor semântica, categorias, insights, redirecionamento seguro, retry de relógio, metas (mensal necessário com juros, ritmo ponderado, estimativa, capacidade, distribuição, simulador, corte por categoria), motor de projeção, assistente (valores, datas, parser, resolvedor, pipeline com IA simulada, avaliação, valor fora da mensagem descartado, fala transcrita), **comprovantes** (sem CPF/CNPJ, soma × total, data, dividir por categoria), **Telegram** (payloads reais, botões ≤ 64 bytes, comandos, renderização) — **~230 testes** |
| Banco (pgTAP) | `pnpm test:db` | Isolamento entre usuários e famílias, papéis, convites, posse/exclusão de conta, faturas, parcelas (ano seguinte, centavos ímpares, fevereiro), recorrências idempotentes, saldos, pagamentos, limite, categorias, auditoria; painel: competência × caixa (somam igual no período fechado), mês vazio, só previstos, parcelas cruzando o ano, fatura paga parcialmente, vários membros, saldo projetado e RLS entre famílias; metas: aporte não é despesa (nada contado duas vezes), retirada com motivo e limite, conclusão automática, aporte planejado idempotente, projeção (mês atual = Fase 3, 36 meses, nada gravado) e RLS; assistente: histórico/sessão/ações só do dono, regras por família, cota atômica e rate limit; Fase 6: um chat por usuário, código de uso único, idempotência do Telegram, dead-letter só para o servidor, push só do dono (https), notificações (preferências, idempotência, antes das 8h nada, outro membro opcional, meta atingida, silêncio, nunca duplica, 5 falhas → dead-letter), cota de foto — **251 asserções** |
| Integração (Vitest + Supabase local) | `pnpm test:integration` | Assistente de ponta a ponta (8 cenários) + **webhook do Telegram** com payloads no formato real (12): segredo inválido → 401, chat não vinculado, grupo ignorado, vinculação por código, idempotência, texto, desfazer pelo botão, **foto** (divide por categoria, sem CNPJ, sempre confirma), **voz**, áudio longo recusado, espaço, desvincular — **20 cenários** |
| Avaliação do assistente | `pnpm eval:assistant` | Parser local contra 173 + 40 mensagens; IA real com `EVAL_PROVIDER=gemini\|groq`; **fotos** (10 comprovantes sintéticos) e **áudios** (12 vozes sintéticas) com `EVAL_MEDIA=photos\|audio` (fora do CI, gasta cota) |
| E2E (Playwright) | `pnpm test:e2e` | Login/validações, cadastro → confirmação → troca de e-mail → exclusão, lançamento em 3 toques, parcelado, desfazer, pagar fatura, recorrência, categoria com reatribuição; painel (filtros na URL + voltar, visões, ocultar valores, tabela, vazio, clique → lista); regressão da 1ª compra parcelada; metas (3 toques, retirada com motivo, conclusão e celebração, simulador, planejamento), lista na visão caixa e projeções, campo de valor; **Canais** (código + QR + link, vinculado/desvincular), **central de notificações** (sino, deep link, lida), **preferências** e silêncio, **guia do iPhone** para push, **foto/microfone** no Assistente; checagens iOS |
| Imagem Docker (CI) | job `docker` | Build multi-stage, contêiner fica `healthy`, roda como `nextjs` (sem root) |
| Smoke de produção | `pnpm test:smoke` | Saúde + Supabase, headers, manifest Lar+, rotas de servidor recusam sem segredo, login, painel, assistente (grava e desfaz) |
| iOS/mobile | `pnpm test:e2e:ios` | Sem rolagem horizontal, barra inferior fixa com alvos ≥ 44 px, safe area, fonte ≥ 16 px (sem zoom do iOS), `inputmode="decimal"`, `100dvh`, meta tags PWA e `apple-touch-icon`, folha de lançamento cabe na tela |

No **CI** (GitHub Actions) tudo isso roda a cada push na `main` e em cada pull request.

### Assistente: acurácia medida e uso de cota

| Camada / conjunto | Mensagens | Intenção | Caso inteiro | Cobertura confiante | Precisão quando confiante |
|---|---|---|---|---|---|
| Parser local — conjunto principal | 169 | 100% | 100% | 96,4% | 100% |
| Parser local — **holdout, 1ª medição (cego)** | 40 | **77,5%** | 75% | 77,5% | **87,1%** |
| Parser local — holdout após correções | 40 | 100% | 100% | 87,5% | 100% |
| Gemini 3.1 Flash-Lite **sozinho** — conjunto principal (prompt sem exemplos) | 169 | 97,6% | 94,7% | 100% | 94,7% |
| Gemini **sozinho** — holdout (prompt final) | 40 | 85% | 82,5% | 87,5% | **94,3%** |
| Groq gpt-oss-20b **sozinho** — conjunto principal | 169 | 92,3% | 79,9% | 100% | 79,9% |
| **Pipeline real** (local → Gemini) — holdout | 40 | **100%** | 100% | 97,5% | 100% |

*Medido em 17–18/11/2026 com `EVAL_PROVIDER=gemini|groq pnpm eval:assistant` (IA real, fora do CI).*

### Fotos e áudios: acurácia medida (18/11/2026, IA real, dados sintéticos)

**Fotos** — Gemini 3.1 Flash-Lite, 10 comprovantes gerados em HTML e fotografados pelo Chromium (NFC-e de mercado+farmácia
com CPF/CNPJ fictícios impressos, cupom de restaurante, notificação Nubank e Inter, comprovante Pix, recibo à mão, print de
fatura, padaria com desconto, uma paisagem e um cupom borrado):

| Campo | Acerto |
|---|---|
| É comprovante? (paisagem recusada) | 100% (10/10) |
| Detecta ilegível (borrado → pede outra foto) | 100% (1/1) |
| Total | 100% (8/8) |
| Data | 100% (5/5) |
| Estabelecimento | 100% (6/6) |
| Forma de pagamento | 100% (7/7) |
| Final do cartão | 100% (3/3) |
| Itens lidos | 100% (3/3) |
| **Não extraiu CPF/CNPJ/contato** | 100% (2/2) |

Tempo: mediana 7,4 s (máx. 24 s, com um 503 do Gemini e nova tentativa). Imagens limpas e geradas por computador são
mais fáceis que fotos reais tortas e com reflexo — **a próxima medição deve ser com cupons seus** (o sistema sempre mostra o
que leu e pede confirmação, então um erro de leitura não vira lançamento sozinho).

**Áudios** — 12 frases faladas por **vozes sintéticas** do macOS (pt-BR), inclusive informais ("gastei cinquentinha no
uber", "caiu mil do freela"), em OGG/Opus como a voz do Telegram:

| Transcritor | Transcrição com o essencial | Intenção certa (pipeline) | Valor certo | Tempo |
|---|---|---|---|---|
| **Groq Whisper large-v3 (padrão)** | **92%** | **92%** | **67%** | ~0,5 s |
| Groq Whisper large-v3-turbo | 75% | 92% | 33% | ~0,6 s |
| Gemini (reserva) | 75% | 83% | 56% | ~1,6 s |

Os erros que sobram são da **voz robótica** ("a tente e cinco" no lugar de "oitenta e cinco"). A medição corrigiu 2 falhas
reais: "cinquentinha"/"vintinho" e "32 e 50" (= R$ 32,50) agora são valores. Quando o valor não é entendido, o assistente
**pergunta**; o que for gravado aparece com "Entendi: '…'" e o botão **Desfazer**. Para exigir confirmação em todo áudio:
`ASSISTANT_CONFIRM_AUDIO=true`.

**Leia com cuidado:** o conjunto principal foi escrito junto com o parser (viés a favor). O número mais honesto é a
**1ª medição do holdout** (40 frases escritas depois): 77,5% de intenção. As correções que vieram depois são regras
gerais (ex.: "botei 70 de gasolina" é gasto, não meta), mas o holdout deixou de ser cego. O app guarda as mensagens
reais no histórico de cada pessoa — a melhor próxima avaliação é com frases suas. Quando o parser não tem
confiança, a mensagem vai para a IA (com chave) ou vira pergunta/confirmação (sem chave): **nada é gravado no
escuro**. Medir a IA real: `EVAL_PROVIDER=gemini EVAL_SET=holdout pnpm eval:assistant`.

**O que a medição real mostrou (e o que foi corrigido):**
- **Gemini entende bem** (94% de acerto nas respostas que chegam), mas no gratuito é **instável**: mediana 3,1 s,
  p95 13 s, e 5 de 40 chamadas falharam (4 por tempo, 1 erro 503). No holdout, os 5 "erros" do Gemini são isso.
  → Tempo limite por provedor: **Gemini 6 s, depois Groq 5 s** (pior caso ≈ 7 s em vez de 16 s).
- **A IA tentou fazer conta**: "netflix e spotify 77,80" virou 38,90 + 38,90. → Regra no sistema: **todo valor da
  IA precisa estar escrito na mensagem**; se não estiver, vira pergunta (ADR-0018).
- **Groq** (reserva): no padrão o modelo "pensava" até esgotar a resposta (JSON vazio) e estourava 8.000 tokens/min
  → `reasoning_effort: "low"` (≈ 1/5 dos tokens). Erra mais categoria (77%) e trata "paguei 120 de luz" como conta
  prevista — aceitável como reserva, já que o sistema confirma tudo que vem da IA.
- Prompt ganhou 6 exemplos e 3 regras gerais (frases diferentes das do conjunto de avaliação); se a IA deixa
  valor/data/parcelas em branco e o parser local achou, o sistema completa.

**Cota estimada para uma família de 2 a 5 pessoas** (≈ 6–10 mensagens/pessoa/dia = 12–50 por dia):
o parser local resolve ~78–88% sozinho → **≈ 2–11 chamadas de IA por dia para a família toda**
(≈ 1–3 por pessoa). O limite gratuito do Gemini 3.1 Flash-Lite (~500/dia **por projeto**) e o do Groq (~1.000/dia)
sobram muito; o limite por usuário do app (40/dia) só protege contra abuso. No Groq, o limite que pesa é o de
**tokens**: 8.000/min e 200.000/dia no gpt-oss-20b ≈ 150 chamadas/dia (cada uma ≈ 1.300 tokens) — ainda folgado.

**Cota total estimada (texto + fotos + áudios), família de 2 a 5 pessoas por dia:**

| Uso | Por pessoa/dia | Família (2–5) | Vai para | Limite gratuito | Folga |
|---|---|---|---|---|---|
| Texto que precisa de IA | 1–3 | 2–11 | Gemini (Groq de reserva) | ~500/dia por projeto (Flash-Lite) | ✅ |
| Fotos de comprovante | 1–3 | 2–15 | Gemini (imagem) | o mesmo ~500/dia do projeto | ✅ |
| Áudios | 1–4 | 2–20 | Groq Whisper | 2.000/dia e 2 h de áudio/hora | ✅ |
| Texto vindo de áudio que precisa de IA | ~1 | ~5 | Gemini/Groq | idem texto | ✅ |
| **Total de IA** | — | **≈ 10–50/dia** | — | — | **cabe no gratuito com folga (~10% do Gemini)** |

O limite por pessoa do app (15 fotos e 30 áudios/dia) protege contra abuso e erro. Confira os números reais no
AI Studio (Gemini) e em *Settings → Limits* (Groq) — o Google não publica o limite exato do Flash-Lite.

### Desempenho (Lighthouse, celular)
Medido em `/painel` com build de produção, logado, dados do seed (12 meses), Lighthouse 12.8, perfil móvel
(4G lento + CPU 4× mais lenta), 3 execuções:

| Modo | Desempenho | LCP | TBT | CLS | Acessibilidade | Boas práticas |
|---|---|---|---|---|---|---|
| Throttling real (`--throttling-method=devtools`) | **95** | **2,3 s** | 70–90 ms | 0 | — | — |
| Simulado (padrão do Lighthouse) | 71–84 | 4,1 s | 140–630 ms | 0 | **100** | 96 |

O modo simulado estima o LCP como se o texto dependesse de todo o JavaScript; no navegador o maior
elemento é pintado em ~0,5 s (sem throttling). Otimizações feitas: agregações no banco (nada de baixar
lançamentos para somar), streaming por bloco com `<Suspense>`, gráficos sem biblioteca, formulário de
lançamento carregado sob demanda, primeira dobra sem animação de opacidade. Para medir de novo:
`pnpm build && pnpm start`, copie o cookie de sessão e rode
`npx lighthouse@12.8.2 http://localhost:3000/painel --form-factor=mobile --extra-headers=headers.json`.

## 13. Testar no iPhone

### a) Emulação (já configurada, qualquer sistema)
Playwright com **WebKit** (motor do Safari) emulando iPhone 15 e iPhone SE: `pnpm test:e2e:ios`.
O **Playwright MCP** está registrado em `.mcp.json`; ao abrir o Claude Code no projeto e aprovar o servidor,
ele consegue navegar no app "como um iPhone" e tirar screenshots.
Limite: a emulação não reproduz a barra dinâmica do Safari, o teclado do iOS nem as safe areas reais.

### b) iOS Simulator (macOS com Xcode)
1. Instale o **Xcode** pela App Store (~15 GB) e abra-o uma vez para aceitar a licença.
2. `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
3. Xcode → *Settings → Components* → instale um **iOS Simulator** (ex.: iOS 26).
4. Teste: `xcrun simctl list devices` e `open -a Simulator`.
5. MCP para o Claude Code controlar o simulador (Safari real do iOS):
   `claude mcp add xcodebuild -- npx -y xcodebuildmcp@latest mcp`
6. Com `pnpm dev` rodando, no Safari do simulador abra `http://localhost:3000`
   (o simulador compartilha a rede do Mac). Teste também um **iPhone SE** para tela pequena.

### c) Seu iPhone de verdade (Wi-Fi)
1. Mac e iPhone **na mesma rede Wi-Fi**.
2. `pnpm dev:lan` → o terminal mostra algo como `📱 Abra no celular: http://192.168.0.62:3000`.
3. No Safari do iPhone, abra esse endereço e entre com uma conta de teste.
4. Para instalar: botão **Compartilhar → Adicionar à Tela de Início** (abre em tela cheia, sem a barra do Safari).

**Se o login/redirecionamento não funcionar pelo IP**
- Use **`pnpm dev:lan`** (não `pnpm dev`): ele ajusta `NEXT_PUBLIC_SITE_URL` para o IP.
- O macOS pode perguntar se o Node pode aceitar conexões: permita (*Ajustes → Rede → Firewall*).
- O Supabase local já aceita redirecionamentos para `http://192.168.*.*:3000/**` e `http://10.*.*.*:3000/**`
  (`supabase/config.toml`). Se sua rede usar outra faixa (ex.: `172.20.x.x`), adicione-a em
  `additional_redirect_urls` e rode `pnpm db:stop && pnpm db:start`.
- Links de e-mail locais (Mailpit) apontam para `localhost`: confirme o e-mail **no computador** e depois
  entre com a senha no iPhone.
- O Next bloqueia origens desconhecidas no modo dev; as faixas de rede local já estão liberadas em
  `allowedDevOrigins` (`next.config.ts`).

## 14. Deploy

Produção em **[larmais.tech](https://larmais.tech)** com **EasyPanel (Docker) na sua VPS** (ADR-0020). Passo a passo
completo, na ordem certa e com consultas de verificação, em [`docs/setup-manual.md`](docs/setup-manual.md). Resumo:

1. **DNS** (§K): `A @` e `www` → IP da VPS; registros da Brevo (SPF/DKIM/DMARC).
2. **VPS + EasyPanel** (§D): 1–2 vCPU, 2 GB RAM, 20 GB, Ubuntu 24.04; app a partir do repositório privado (deploy key
   só leitura), build pelo `Dockerfile`, variáveis (as `NEXT_PUBLIC_*` entram no build), domínio com HTTPS automático,
   deploy a cada push na `main`, logs e *Redeploy* para voltar versão.
3. **Supabase de produção** (§C) — **você aplica**: `supabase link` + `supabase db push`, Auth (Site URL
   `https://larmais.tech`), templates Lar+, SMTP Brevo, segredos do Vault para o pg_cron, advisors.
4. **Telegram** (§F): token do @BotFather no EasyPanel, `pnpm telegram set`, `/setuserpic` com
   `public/brand/telegram-avatar.png`.
5. **Notificações** (§G): `pnpm vapid` + `CRON_SECRET`.
6. **Smoke test** (§J): `E2E_BASE_URL=https://larmais.tech pnpm test:smoke`.

```bash
# imagem local (o CI faz o mesmo a cada push)
docker build -t larmais --build-arg NEXT_PUBLIC_SUPABASE_URL=... --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... \
  --build-arg NEXT_PUBLIC_SITE_URL=https://larmais.tech --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY=... .
docker run -p 3000:3000 --env-file .env.producao larmais     # /api/health → {"status":"ok"}
```

**Repositório privado:** o GitHub Actions continua igual (2.000 min/mês no Free; cada CI ~8–10 min com o job Docker;
limite de gasto US$ 0 = sem cobrança surpresa). O EasyPanel lê o repositório pela deploy key.

## 15. Regras de negócio em linguagem simples

Todas as regras numeradas estão em [`docs/requisitos.md`](docs/requisitos.md).

**Fatura do cartão.** Cada cartão tem um dia de **fechamento** e um de **vencimento**.
- Compra **antes** do dia do fechamento → entra na fatura que fecha neste mês.
- Compra **no dia** do fechamento ou depois → vai para a **próxima** fatura.
- Se o vencimento é depois do fechamento no calendário (fecha 3, vence 10), vence no mesmo mês;
  se não (fecha 25, vence 5), vence no mês seguinte.
- A fatura recebe o nome do **mês em que vence**. Ex.: Nubank fecha dia 3 e vence dia 10:
  compra em 02/11 → fatura de **novembro** (vence 10/11); compra em 03/11 → fatura de **dezembro** (vence 10/12).
- Dia de fechamento 29, 30 ou 31 em mês curto vira o último dia do mês.

**Compra no crédito × pagamento da fatura.** A **compra é a despesa** — ela aparece nos gastos do mês na
data da compra. **Pagar a fatura não é uma nova despesa**: é só o dinheiro saindo da sua conta para o
cartão. Por isso o pagamento baixa o **saldo da conta** e libera **limite** do cartão, mas não aumenta
"despesas do mês". Assim nada é contado duas vezes.

**Parcelamento.** O total é dividido em parcelas inteiras de centavos e **o centavo que sobra vai na
1ª parcela**: R$ 100,00 em 3x = 33,34 + 33,33 + 33,33. A 1ª parcela cai na fatura da compra; as próximas, nas
faturas dos meses seguintes (mesmo atravessando o ano). Cada parcela conta como gasto no mês dela.
Ao editar/excluir, você escolhe: **só esta**, **esta e as próximas** ou **todas**.

**Limite do cartão.** Usado = tudo que foi comprado no cartão (incluindo parcelas futuras) − o que já foi
pago. Disponível = limite − usado.

**Recorrências.** Você cadastra uma vez (ex.: aluguel dia 10). O sistema lança sozinho as ocorrências do
mês (na hora em que você cria e todo dia às 3h). Dia 31 vira o último dia em meses curtos. Elas entram
como **previstas** (ainda não pagas) até você tocar em ✓, ou já como pagas, se você marcar essa opção.
Rodar a geração várias vezes **nunca duplica**. Ao editar, você escolhe se os **previstos a partir de hoje**
também mudam; o que já foi confirmado nunca muda.

**Saldo da conta.** Saldo inicial + receitas recebidas − despesas pagas (fora do crédito) + transferências
que entraram − transferências que saíram − pagamentos de fatura. Lançamentos previstos aparecem à parte.

**Competência × caixa (painel).** São duas formas de olhar o **mesmo** dinheiro:
- **Competência** (padrão): o gasto conta no mês em que você **comprou**. Parcelado em 10x? Cada parcela
  conta no seu mês.
- **Caixa**: a compra no cartão conta no mês em que a **fatura vence** (quando o dinheiro sai da conta). Pix,
  débito, dinheiro e receitas contam no próprio dia nas duas visões.
- Exemplo com o seed: o notebook de R$ 4.999,90 em 10x no Nubank (fecha dia 3, vence dia 10) foi comprado no
  dia 14. Na competência, cada parcela de R$ 499,99 aparece no dia 14 de cada mês; na caixa, no dia 10 do mês
  seguinte. Somando todos os meses, as duas visões dão o mesmo total.
- **Realizado × previsto**: previsto é o que ainda não aconteceu — recorrência não confirmada, parcela de
  mês futuro ou (na caixa) fatura ainda não quitada.

**Saldo projetado.** Saldo de hoje nas contas + receitas previstas − despesas previstas (fora do cartão) −
o que falta pagar das faturas que vencem até o fim do mês. O cartão entra só pela fatura, nunca duas vezes.

**Metas: guardar não é gastar.** Quando você guarda R$ 300 para a viagem, o dinheiro **sai da conta** (o
saldo disponível diminui) e vai para a **reserva da meta** (uma conta como a Poupança, ou a "caixinha" da própria
meta). Isso **não entra em despesas** — senão o mês pareceria mais caro justamente quando você economiza.
O painel mostra "Guardado em metas" separado, e a taxa de economia diz quanto da renda foi para metas.

**Quanto guardar por mês e quando chego lá.** "Por mês até o prazo" = o que falta ÷ meses até o prazo (com
rendimento, a conta usa juros compostos). "Chega em" usa o **aporte planejado** (se houver) ou o seu **ritmo
real**: a média dos últimos 6 meses fechados, com mais peso nos mais recentes (mês sem aporte conta como zero).
Se essa data passar do prazo, a meta fica "Atrasada"; antes, "Adiantada".

**Projeção.** Meses futuros são calculados a partir das **regras** (recorrências ativas, parcelas e faturas), até
36 meses, sem criar lançamentos no banco. O mês atual é sempre igual ao que já está lançado.

**Assistente: quando ele grava sozinho e quando pergunta.** Mensagem simples e clara ("gastei 50 no uber") com
valor até R$ 1.000 é gravada na hora, com botão **Desfazer**. Ele **pede confirmação** quando a mensagem tem
vários lançamentos, quando precisou da IA, quando não tem certeza (ex.: não achou a categoria) ou quando o valor é
alto. Ele **pergunta** quando falta algo (valor, cartão, conta) ou quando um nome serve para duas coisas
("no nubank": cartão ou conta?). "Paguei o aluguel" sem valor confirma o aluguel **previsto**. "Desfazer" apaga
o último registro feito pelo assistente (até 24 h).

**Arredondamento e dinheiro.** Tudo é guardado em **centavos inteiros**, nunca com casas decimais "quebradas"
de computador (0,1 + 0,2 ≠ 0,3 em ponto flutuante). Datas usam sempre o horário de São Paulo.

## 16. Convenções e como contribuir

- **Código**: TypeScript estrito; Zod em toda entrada; Server Actions retornam `ActionState`; UI só com tokens
  do design system; regras de data **em SQL e em TS com os mesmos casos de teste**; detalhes no `CLAUDE.md`.
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/pt-br/) em português —
  `feat(cartoes): pagamento parcial de fatura`, `fix(mobile): …`, `test(db): …`, `docs: …`, `chore: …`.
  Commits pequenos e com testes passando.
- **Branches**: `main` sempre verde e protegida (sem force push). Trabalho novo em `feat/<assunto>`,
  `fix/<assunto>` → pull request → CI verde → merge.
- **Contribuir**: 1) crie a branch; 2) se mexer no banco, crie migration + teste pgTAP; 3) `pnpm check` e
  `pnpm test:e2e`; 4) se mudou a UI, valide no iPhone (seção 13) e rode `pnpm screenshots`; 5) atualize docs/ADR.

## 17. Solução de problemas

| Sintoma | Causa | Solução |
|---|---|---|
| `JWT issued at future` (PGRST303) logo após login/troca de senha | O PostgREST atualiza o relógio ~1×/s e recusa um token recém-criado | Já tratado: o app repete a consulta após 1,1 s (`fetch-with-clock-skew-retry.ts`). Se persistir localmente, reinicie o Docker (relógio da VM atrasado após o Mac dormir). |
| `Cannot connect to the Docker daemon` / `supabase start` falha | Docker fechado | Abra o Docker Desktop e espere ficar "running". |
| E-mail de confirmação não chega (local) | Os e-mails ficam no Mailpit | Abra <http://127.0.0.1:54324>. Se nada chegar, veja `docker logs supabase_auth_dashboard-financas`. |
| E-mail não chega (produção) | SMTP padrão do Supabase só envia para a equipe e com limite baixíssimo | Configure o SMTP da Brevo (seção 14). |
| `Route "/x": … uncached data … outside of <Suspense>` | Regra do Next 16 (Cache Components) | Coloque a leitura de sessão/dados dentro de `<Suspense>` na página (ADR-0008). |
| `Next.js encountered the unstable value Date.now()` | Algo dependente do horário durante o prerender | Use o `createClient()` do projeto (já chama `connection()`) ou `await connection()`. |
| Aviso de *hydration mismatch* no tema | O tema só é conhecido no navegador | Use `useMounted()` antes de mostrar o tema selecionado. |
| Página rola para os lados no iPhone | Item de grid crescendo até o conteúdo | Use `grid-cols-[minmax(0,1fr)]` e `min-w-0`. |
| iPhone não abre o app pelo IP | Rede diferente, firewall ou `pnpm dev` | Mesma rede Wi-Fi, permitir o Node no firewall, usar `pnpm dev:lan` (seção 13). |
| Teste E2E com "strict mode violation" | O Next 16 mantém a tela anterior oculta no DOM | Use `{ exact: true }` ou `.filter({ visible: true })`. |
| Tipos do banco desatualizados | Migration nova | `pnpm db:types`. |
| `Port 3000 is in use` | Outro servidor aberto | Feche-o ou use `PORT=3001 pnpm dev`. |
| Projeto da nuvem "pausado" | Supabase Free pausa após 7 dias sem uso | Painel do Supabase → *Restore project*. |
| `CVDisplayLinkCreateWithCGDisplay failed` nos testes | Aviso do Chromium headless no macOS | Inofensivo, pode ignorar. |

## 18. Roadmap, limitações, custos, changelog e licença

**Roadmap**: Fases 0–6 ✅ · Fase 7 (CSV/OFX) ⏭️ · Fase 8 planejada — detalhes em
[`docs/roadmap.md`](docs/roadmap.md).

**Limitações conhecidas**
- Validação em iOS Simulator e iPhone físico ainda pendente (a emulação WebKit cobre o layout); **push só testável
  em iPhone real** (roteiro em `docs/setup-manual.md` §G).
- Acurácia de fotos/áudios medida com dados **sintéticos**; medir com cupons e vozes reais da família.
- Bot só em conversa privada (grupo da família: avaliar no futuro — ADR-0021). WhatsApp fora por custo.
- Falha ao processar uma mensagem do Telegram não é reprocessada sozinha (o conteúdo não é guardado): a pessoa é avisada.
- Gemini gratuito é instável em alguns horários (503/lentidão); o app corta em 6 s e passa ao Groq/parser local.
- Assistente: estornos no cartão e edição de lançamentos já existentes por mensagem não são suportados.
- Comparação com a média de 3 meses só na visão por mês.
- Meta com imagem própria (upload) ficou para depois: hoje é ícone + cor (evita custo/armazenamento agora).
- O ritmo de uma meta usa meses fechados: aportes do mês atual mudam "falta" e "por mês", e entram no ritmo no mês seguinte.
- Sem modo offline ainda (o service worker atual só cuida de push; offline na Fase 8).
- Trilha de auditoria sem política de retenção (Fase 8).
- Estornos no cartão e importação de extratos: Fase 7.

**Custos dos planos gratuitos (avisos)**
| Serviço | Limite gratuito relevante | Risco |
|---|---|---|
| Supabase Free | 500 MB de banco; **pausa após 7 dias sem uso** | Reativar no painel |
| VPS + EasyPanel | VPS que você já paga; EasyPanel no plano gratuito (1 projeto) | Se o EasyPanel pedir plano pago, pare e me avise |
| GitHub Actions (repo privado) | 2.000 min/mês no Free; limite de gasto padrão US$ 0 | CI para até o mês virar (sem cobrança) |
| Brevo | ~300 e-mails/dia | Mais que suficiente |
| Domínio larmais.tech | Já registrado | Renovação anual (já sua) |
| Telegram Bot API | Gratuito, sem limite prático para uma família | — |
| WhatsApp | **Fora do escopo**: desde 01/10/2026 a Meta cobra respostas acima de 1.000/mês | — |
| Web Push (Apple/Google/Mozilla) | Gratuito (VAPID) | — |
| Cloudflare Tunnel (testes locais) | Túnel rápido gratuito, sem conta | — |
| Gemini (Fase 5) | ~500 pedidos/dia no 3.1 Flash-Lite (por projeto); dados do gratuito podem ser usados pelo Google | Sem cartão cadastrado não há cobrança; o app cai para Groq/local |
| Groq (Fase 5/6) | texto: 30/min, 1.000/dia e 200 mil tokens/dia (gpt-oss-20b); áudio: 20/min, 2.000/dia, 2 h/hora (Whisper) | Idem |

**Changelog resumido**
- **Fase 6 — Lar+** — nova identidade (logo, ícones, telas de abertura, e-mails); produção em Docker/EasyPanel em
  larmais.tech (standalone, sem root, healthcheck, CSP/HSTS, smoke test); **@LarMaisBot** no Telegram (webhook com
  segredo, idempotência, vinculação por código/QR, botões, sessão do próprio usuário); **fotos** de comprovantes e
  **áudio** no Telegram e no app; **notificações** push/Telegram/central com preferências, silêncio, fila e dead-letter;
  IA real medida e ajustada (valor fora da mensagem descartado, timeout por provedor, Whisper large-v3).
- **Fase 5** — assistente no app: parser local + Gemini/Groq atrás de interface (a IA só interpreta), 10 intenções,
  vários itens por mensagem, perguntas com opções, confirmação editável, desfazer em lote, aprendizado de
  categoria, consultas calculadas pelo banco, histórico apagável, cota e rate limit, aviso de privacidade; API
  interna de lançamentos; avaliação com 209 mensagens; testes de integração no CI.
- **Fase 4** — metas (individuais/família) com aportes, retiradas, aporte planejado, conclusão e celebração;
  cálculos de mensal necessário, ritmo ponderado, data estimada e status; simulador "e se" e corte por categoria;
  Planejamento (sobra, compromissos, inviabilidade, distribuição); "guardado em metas" no painel; motor de
  projeção por regras (36 meses); lista na visão caixa e com projeções; API interna para IA/bot; correção do
  campo de valor ao tocar no meio.
- **Fase 3** — painel com KPIs e variação semântica, saldo projetado, visões competência × caixa,
  realizado × previsto, gráficos (categorias, 12 meses, média, limites), vencimentos, maiores gastos, por
  membro e por meio; insights por regra; filtros na URL; ocultar valores; tabela alternativa; camada
  analítica no banco com índices medidos; seed de 12 meses; correções: 1ª compra parcelada num cartão novo
  e estouro de largura em /contas no iPhone SE.
- **Fase 2** — lançamento rápido em 3 toques; lançamentos com filtros e desfazer; cartões, faturas
  calculadas e pagamento; parcelamento com escopo; recorrências com pg_cron; transferências; contas com
  saldo calculado; categorias e subcategorias; auditoria; seed de demonstração; E2E da Fase 2.
- **Fase 1+** — troca de e-mail, exclusão de conta, transferência de posse; Playwright (iPhone/Android),
  CI no GitHub Actions, `dev:lan`, ícones/manifest PWA, correções de safe area.
- **Fase 1** — Next.js 16 + Supabase, RLS multi-tenant, autenticação, família e convites, design system.
- **Fase 0** — Requisitos, arquitetura, modelo de dados, ADRs, design system, roadmap.

**Licença.** *Todos os direitos reservados* (projeto pessoal, repositório privado).
Sem arquivo `LICENSE`, ninguém pode reutilizar o código sem permissão. Se um dia quiser abrir de verdade,
a sugestão é **MIT** — basta adicionar o arquivo `LICENSE`.
