# APIs internas (metas, lançamentos, assistente, Telegram e notificações)

> Contrato comum (`src/lib/service-result.ts`): `Ctx = { supabase, userId, today? }` com a **sessão do usuário**
> (RLS decide) e `Result<T>` (`ok`/`message`/`fieldErrors`), nunca exceção para erro de negócio.

## Lançamentos (`src/lib/ledger/service.ts`) — Fase 5
| Função | Efeito |
|---|---|
| `registrarLancamento(ctx, input, { source? })` | Receita, despesa, compra no cartão (à vista/parcelada via `create_card_purchase`) ou transferência; `input` = `entrySchema`. `source` = `manual` (telas) ou `assistant`. Devolve `{ id, table, installmentPlan, message }`. |
| `excluirLancamento(ctx, table, id)` | Apaga lançamento (restaurável por 24 h) ou transferência. |
| `excluirCompraParcelada(ctx, transactionId)` | Apaga todas as parcelas a partir de qualquer uma. |
| `confirmarLancamento(ctx, id, settled = true)` | Previsto → pago/recebido (ou volta, no "desfazer"). |

As Server Actions de lançamento (`src/app/(app)/_actions/ledger.ts`) chamam estas funções.

## Assistente (`src/lib/assistant/server/engine.ts`) — Fase 5
`handleAssistant(ctx: EngineCtx, input: ChatInput): Promise<ChatReply[]>` — ponto de entrada **de todos os canais**.
- `EngineCtx = Ctx & { channel: "app" | "whatsapp" | "telegram", activeWorkspaceId, workspaces, providers? }`
- `ChatInput`: `{ kind: "text", text }` · `{ kind: "confirm", pendingId, edits? }` · `{ kind: "cancel", pendingId }` ·
  `{ kind: "choose", pendingId, value }` · `{ kind: "undo", batchId? }` ·
  **Fase 6:** `{ kind: "chooseIndex", pendingId, index }` (botões de canais de texto) ·
  `{ kind: "image", mimeType, base64 }` (comprovante; sempre confirma) · `{ kind: "audio", mimeType, base64, seconds?, filename? }`
- `ChatReply`: `text` (pronto para qualquer canal), `tone`, e opcionalmente `card` (itens a confirmar, editáveis),
  `question` (opções numeradas), `done` (linhas gravadas + `batchId` para desfazer, `celebrate`).
- Canais de texto: responder "1"/"2", "sim"/"cancelar", o valor ou o motivo continua a conversa pendente.
- Cartão pendente aceita correção por texto: "valor 45,90", "categoria mercado", "data ontem", "item 2 valor 30".
- `PendingCard` ganhou `media` (o que foi lido na foto + alertas) e `extras` ("Dividir por categoria"/"Lançar como um
  único gasto", escolhidos com `choose`/`chooseIndex`). `ChatReply.transcript` traz o que foi entendido do áudio.

## Telegram (`src/lib/telegram/`) — Fase 6
| Módulo | Papel |
|---|---|
| `webhook.ts#handleTelegramWebhook(request, schedule, deps?)` | Segredo → idempotência (`telegram_updates`) → 200 → `schedule(processUpdate)` |
| `handler.ts#processUpdate(update, deps?)` | Anti-flood, vínculo, comandos, espaço, texto/foto/voz/botões → `handleAssistant` |
| `session.ts#createUserClient(userId)` | Cliente Supabase **com a sessão do usuário** (RLS) — use sempre para dados |
| `render.ts` | Puro: `renderReply` (HTML + teclado), `encodeCallback`/`decodeCallback` (≤ 64 bytes), comandos |
| `update.ts` | Puro: schema do update e `classify` |
| `api.ts` | `sendMessage`, `editMessage`, `downloadFile` (memória), retentativa em 429/5xx |

Outro canal no futuro = outro adapter com a mesma forma (identificar → sessão do usuário → `handleAssistant` → render).

## Notificações (`src/lib/notifications/`) — Fase 6
- Criação **só no banco**: `private.notify(user, workspace, kind, event_key, title, body, url)` (respeita preferências,
  idempotente). Tipos em `kinds.ts` (mesmos do banco).
- `dispatch.ts#dispatchNotifications(limit)`: `claim_notification_deliveries` → Web Push (`push.ts#sendPush`) ou
  Telegram → `finish_notification_delivery(sent|skipped|retry)`. Chamado por `POST /api/notifications/dispatch`.

# API interna de metas (`src/lib/goals/service.ts`)

Camada de **serviço de domínio** da Fase 4. Toda regra de metas passa por aqui — as telas (Server Actions
em `src/app/(app)/_actions/goals.ts`) e, nas próximas fases, a **IA** (Fase 5) e o **bot do WhatsApp/Telegram**
(Fase 6). Assim ninguém duplica lógica: o bot que entende "guardei 300 pra viagem" chama `registrarAporte`.

## Contrato

```ts
type Ctx = { supabase: SupabaseClient<Database>; userId: string; today?: ISODate };
type Result<T> = { ok: true; data: T } | { ok: false; message: string; fieldErrors?: Record<string, string[] | undefined> };
```

- **Entrada validada com Zod** (`src/lib/validation/goals.ts`). Aceita FormData convertido (strings) **ou**
  JSON (números/booleanos) — a IA pode mandar `{ amountCents: 30000 }` direto.
- **Erros de negócio nunca lançam exceção**: voltam `ok: false` com mensagem em pt-BR pronta para mostrar
  ao usuário (ou para o bot responder).
- **Permissão = RLS**: o `supabase` precisa ser um cliente com a **sessão do usuário**. O bot (Fase 6)
  deve criar um cliente com o JWT do usuário vinculado ao número — nunca usar a *secret key* sem checar
  `private.is_member`.
- `today` opcional (padrão: hoje em São Paulo) — útil em testes e para o bot responder "como está hoje".
- Valores sempre em **centavos** (inteiros). Datas `YYYY-MM-DD`.

## Consultas

| Função | Entrada | Devolve |
|---|---|---|
| `listarMetas(ctx, workspaceId, { includeArchived? })` | id do espaço | `GoalView[]`: guardado, alvo, previsto, plano, `progress` (falta, %, excedente), `required` (mensal necessário e tipo: `monthly`, `this_month`, `overdue`, `no_deadline`, `done`), `paceCents` (ritmo ponderado), `estimate` (base `plan`/`history`, meses, data, status `ahead`/`on_track`/`behind`/…) |
| `consultarProgressoMeta(ctx, goalId)` | id da meta | `GoalDetail`: a meta, histórico de aportes/retiradas (com previstos), contribuição por membro e séries do gráfico (`realized`, `projected`, `ideal`) |
| `simularMeta(ctx, { goalId, monthlyCents?, targetDate?, targetCents?, annualReturnBps? })` | parâmetros "e se" | `Simulation` (`required`, `estimate`, `series`) — **não salva nada**. Sem `monthlyCents`, usa o ritmo atual |
| `consultarPlanejamento(ctx, workspaceId)` | id do espaço | `capacity` (renda, fixas, variáveis, sobra, comprometido, sobra livre), `distribution` (sugestão por meta, total necessário, viável?, quanto falta) e as metas |

## Comandos

| Função | Entrada (Zod) | Efeito |
|---|---|---|
| `criarMeta(ctx, input)` | `goalSchema`: `workspaceId`, `name`, `targetCents`, `targetDate?`, `priority` (1–3), `icon`, `color`, `initialCents`, `reserveAccountId?`, `annualReturnPct` (0–50), `notes?` | Cria a meta no espaço (individual ou família). Devolve `{ id }` |
| `atualizarMeta(ctx, input)` | `goalSchema` + `id` | Atualiza; o status é reavaliado (alvo menor → pode concluir) |
| `alterarStatusMeta(ctx, { goalId, status })` | `active` · `paused` · `archived` (· `achieved`) | Pausar, retomar, arquivar, reabrir |
| `excluirMeta(ctx, goalId)` | — | Apaga a meta e o histórico (só quem criou ou admin) |
| `registrarAporte(ctx, input)` | `contributionSchema`: `workspaceId`, `goalId`, `kind` (`deposit`/`withdrawal`), `amountCents` (> 0), `contributedOn`, `accountId?`, `memberUserId?`, `note?` (obrigatória na retirada), `source` (`manual`/`whatsapp`/`telegram`) | Registra o movimento (não é despesa — ADR-0016). Devolve `{ id, goal, achievedNow }` — `achievedNow` permite o bot comemorar |
| `excluirAporte(ctx, id)` | — | Remove o movimento (quem registrou ou admin) |
| `confirmarAportePrevisto(ctx, id)` | — | Previsto → confirmado (entra no guardado e nos saldos) |
| `definirAportePlanejado(ctx, input)` | `planSchema`: `workspaceId`, `goalId`, `amountCents`, `frequency`, `dayOfMonth`, `accountId?`, `startsOn`, `autoConfirm` | Cria o plano (recorrência com `goal_id`); encerra o plano anterior e os previstos futuros dele |
| `removerAportePlanejado(ctx, goalId)` | — | Encerra o plano e apaga os previstos de hoje em diante |

## Exemplos de uso futuro

```ts
// Fase 6 — "guardei 300 pra viagem" (depois da IA identificar a meta pelo nome)
const res = await registrarAporte(ctx, {
  workspaceId, goalId: viagem.id, kind: "deposit", amountCents: 30000,
  contributedOn: todayISO(), source: "whatsapp",
});
if (!res.ok) return reply(res.message);
reply(res.data.achievedNow
  ? `🎉 Meta ${res.data.goal.name} concluída!`
  : `Guardado! Faltam ${formatBRL(res.data.goal.progress.remainingCents)} (${shortMonth(res.data.goal.estimate.date)}).`);

// Fase 5 — "e se eu guardar 800 por mês para o carro?"
const sim = await simularMeta(ctx, { goalId: carro.id, monthlyCents: 80000 });
```

## Funções puras usadas por baixo (`src/lib/goals/math.ts`)
`progress`, `requiredMonthly`, `weightedPace`, `monthsToReach`, `estimate`, `savingsCapacity`, `distribute`,
`simulate`, `categoryCutScenario`, `realizedSeries`, `projectedSeries`, `idealSeries`, `contributionsByMember`
— todas testadas em `src/lib/goals/__tests__/math.test.ts` (fórmulas em `docs/requisitos.md`, RN-78…RN-86).
