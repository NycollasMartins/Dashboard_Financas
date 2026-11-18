import "server-only";
import { addDays } from "@/lib/analytics/period";
import { todayISO, type ISODate } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import type { Ctx } from "@/lib/service-result";
import { findDate } from "../dates";
import { describeAction, HELP_TEXT, summaryLine, type ActionView } from "../format";
import { DOC_LABEL, PHOTO_TIPS, receiptSchema, receiptSummary, receiptToItem, splitByCategory, validateReceipt, type Receipt } from "../media/receipt";
import { interpret } from "../interpret";
import { CONFIDENT } from "../local-parser";
import { findAmounts } from "../money";
import { normalize } from "../normalize";
import type { AiParser } from "../providers/types";
import { applyAnswer, resolveItem, type Action, type Lookups, type Option, type Question } from "../resolver";
import type { Interpretation, ParsedItem, Provider } from "../types";
import { assistantConfig, defaultProviders } from "./config";
import { confirmPlanned, executeAction, learnCategory, undoBatch, type Channel, type InputKind } from "./executor";
import { loadLookups } from "./lookups";
import { answerQuery } from "./queries";

/*
 * MOTOR DE CONVERSA — independente de canal (ADR-0018). O app, e depois o
 * WhatsApp/Telegram (Fase 6), chamam handleAssistant() e recebem respostas
 * ESTRUTURADAS (texto, cartão de confirmação, opções, "desfazer"). O estado
 * (aguardando confirmação/escolha) fica em assistant_sessions, expira em 15 min.
 * Respostas em texto também funcionam ("1", "sim", "cancelar") → canais de texto.
 */

export type Workspace = { id: string; kind: "personal" | "household"; name: string };
export type EngineCtx = Ctx & {
  channel: Channel;
  activeWorkspaceId: string;
  workspaces: Workspace[];
  providers?: AiParser[];
  /** Interno: de onde veio a mensagem atual (auditoria). */
  inputKind?: InputKind;
};
export type ImageMime = "image/png" | "image/jpeg" | "image/webp";

export type ChatInput =
  | { kind: "text"; text: string }
  | { kind: "confirm"; pendingId: string; edits?: { index: number; amountCents?: number; categoryId?: string | null; date?: string; description?: string }[] }
  | { kind: "cancel"; pendingId: string }
  | { kind: "choose"; pendingId: string; value: string }
  | { kind: "undo"; batchId?: string }
  /** Botões de canais de texto (Telegram): a opção pela posição. */
  | { kind: "chooseIndex"; pendingId: string; index: number }
  /** Fase 6 — foto de comprovante (processada em memória e descartada). */
  | { kind: "image"; mimeType: ImageMime; base64: string }
  /** Fase 6 — áudio curto (transcrito e descartado). */
  | { kind: "audio"; mimeType: string; base64: string; seconds?: number; filename?: string };

export type PendingCard = {
  pendingId: string;
  reason: string;
  workspaceName: string;
  items: (ActionView & { index: number })[];
  categories: { id: string; name: string; kind: "income" | "expense" }[];
  /** Foto: o que foi lido + alertas (soma × total, data, duplicata). */
  media?: { summary: string; warnings: string[] };
  /** Ações extras (ex.: "Dividir por categoria"), escolhidas por `choose`. */
  extras?: Option[];
};
export type ChatReply = {
  text: string;
  tone?: "info" | "success" | "warning" | "error";
  card?: PendingCard;
  question?: { pendingId: string; options?: Option[] };
  done?: { batchId: string; lines: string[]; undoable: boolean; celebrate?: string };
  /** Áudio: o que foi entendido. */
  transcript?: string;
};

type Pending = {
  id: string;
  workspaceId: string;
  originalText: string;
  provider: Provider;
  items: ParsedItem[];
  actions: (Action | null)[];
  question?: { index: number; q: Question };
  confirmPick?: { options: Option[] };
  reason?: string;
  inputKind?: InputKind;
  /** Foto: lançar como um único gasto × dividido por categoria. */
  alt?: { single: ParsedItem; split: ParsedItem[] | null };
  media?: { summary: string; warnings: string[] };
};

const SESSION_MINUTES = 15;
const uuid = () => crypto.randomUUID();
const nowLocal = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date()).replace(" ", "T");

async function loadPending(ctx: EngineCtx): Promise<Pending | null> {
  const { data } = await ctx.supabase.from("assistant_sessions").select("state, expires_at").eq("user_id", ctx.userId).eq("channel", ctx.channel).maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) return null;
  const st = data.state as { pending?: Pending };
  return st.pending ?? null;
}
async function savePending(ctx: EngineCtx, pending: Pending | null) {
  await ctx.supabase.from("assistant_sessions").upsert(
    { user_id: ctx.userId, channel: ctx.channel, state: pending ? { pending } : {}, expires_at: new Date(Date.now() + SESSION_MINUTES * 60_000).toISOString() },
    { onConflict: "user_id,channel" },
  );
}

function pickWorkspace(ctx: EngineCtx, items: ParsedItem[]): Workspace {
  const want = items.find((i) => i.workspace)?.workspace;
  const active = ctx.workspaces.find((w) => w.id === ctx.activeWorkspaceId) ?? ctx.workspaces[0];
  if (want === "familia") return ctx.workspaces.find((w) => w.kind === "household") ?? active;
  if (want === "individual") return ctx.workspaces.find((w) => w.kind === "personal") ?? active;
  return active;
}

const YES = /^(sim|s|ok|okay|confirma|confirmar|confirmo|isso|pode|pode ser|manda|beleza|blz|certo|correto|👍)$/;
const NO = /^(nao|n|cancela|cancelar|deixa|esquece|para|errado)$/;

/** Ponto de entrada único do assistente (todos os canais). */
export async function handleAssistant(ctx: EngineCtx, input: ChatInput): Promise<ChatReply[]> {
  const today = ctx.today ?? todayISO();
  const c = { ...ctx, today };
  if (input.kind === "undo") return undo(c, input.batchId);
  if (input.kind === "image") return fromImage(c, input);
  if (input.kind === "audio") return fromAudio(c, input);

  const pending = await loadPending(c);
  if (input.kind === "chooseIndex") {
    const opts = pending?.question?.q.options ?? pending?.confirmPick?.options ?? (pending ? extrasOf(pending) : []);
    const opt = pending && pending.id === input.pendingId ? opts[input.index] : undefined;
    if (!opt) return [{ text: "Essa opção expirou. Mande a mensagem de novo.", tone: "warning" }];
    return choose(c, pending, pending!.id, opt.value);
  }
  if (input.kind === "cancel") {
    await savePending(c, null);
    return [{ text: "Cancelado. Nada foi gravado.", tone: "info" }];
  }
  if (input.kind === "confirm") return confirm(c, pending, input.pendingId, input.edits ?? []);
  if (input.kind === "choose") return choose(c, pending, input.pendingId, input.value);

  // Texto: pode ser resposta a uma pergunta/confirmação pendente (canais de texto).
  const raw = input.text.trim().slice(0, 1000);
  const t = normalize(raw);
  if (pending) {
    if (pending.question || pending.confirmPick) {
      const opts = pending.question?.q.options ?? pending.confirmPick?.options;
      if (opts?.length) {
        const n = Number(t);
        const byIndex = Number.isInteger(n) && n >= 1 && n <= opts.length ? opts[n - 1] : null;
        const byLabel = opts.find((o) => normalize(o.label) === t || normalize(o.label).includes(t));
        if (byIndex || (byLabel && t.length >= 3)) return choose(c, pending, pending.id, (byIndex ?? byLabel)!.value);
      } else if (pending.question?.q.field === "amount") {
        const amount = findAmounts(t)[0];
        if (amount) return choose(c, pending, pending.id, String(amount.cents));
      } else if (pending.question?.q.field === "note" && t && !NO.test(t)) {
        return choose(c, pending, pending.id, raw);
      }
      if (NO.test(t)) {
        await savePending(c, null);
        return [{ text: "Cancelado. Nada foi gravado.", tone: "info" }];
      }
    } else if (YES.test(t)) return confirm(c, pending, pending.id, []);
    else if (pending.actions.every(Boolean) && pending.actions.length) {
      // Cartão pendente: correção por texto ("valor 45,90", "categoria mercado", "data ontem").
      const edit = await textEdit(c, pending, raw, t);
      if (edit) return edit;
    }
    else if (NO.test(t)) {
      await savePending(c, null);
      return [{ text: "Cancelado. Nada foi gravado.", tone: "info" }];
    }
  }
  return fresh(c, raw);
}

async function fresh(ctx: EngineCtx & { today: ISODate }, text: string): Promise<ChatReply[]> {
  if (!text) return [{ text: HELP_TEXT, tone: "info" }];
  const active = ctx.workspaces.find((w) => w.id === ctx.activeWorkspaceId) ?? ctx.workspaces[0];
  let { lk, names } = await loadLookups(ctx, active.id);
  const interp: Interpretation = await interpret(text, {
    today: ctx.today,
    nowLocal: nowLocal(),
    names,
    providers: ctx.providers ?? defaultProviders(),
    takeQuota: async (provider) => {
      const { data, error } = await ctx.supabase.rpc("assistant_take_quota", {
        p_provider: provider, p_daily_limit: assistantConfig.dailyLimit, p_per_minute: assistantConfig.perMinute,
      }).single();
      if (error || !data) return { allowed: false, reason: "erro-cota" };
      return { allowed: data.allowed, reason: data.reason };
    },
  });
  if (!interp.items.length) {
    return [{ text: `Não entendi. ${HELP_TEXT.split("\n").slice(0, 3).join("\n")}\nDigite “ajuda” para mais exemplos.`, tone: "warning" }];
  }

  // Espaço pedido na mensagem ("na família") — só se a pessoa for membro.
  const ws = pickWorkspace(ctx, interp.items);
  if (ws.id !== active.id) ({ lk, names } = await loadLookups(ctx, ws.id));

  const replies: ChatReply[] = [];
  const toResolve: ParsedItem[] = [];
  for (const item of interp.items) {
    if (item.intent === "ajuda") replies.push({ text: HELP_TEXT, tone: "info" });
    else if (item.intent === "desfazer_ultimo") replies.push(...(await undo(ctx)));
    else if (item.intent === "consultar") replies.push({ text: await answerQuery(ctx, lk, item, ctx.today), tone: "info" });
    else if (item.intent === "confirmar_previsto") replies.push(...(await findPlanned(ctx, ws, lk, item, text, interp.provider)));
    else toResolve.push(item);
  }
  if (!toResolve.length) return replies;

  const pending: Pending = {
    id: uuid(),
    workspaceId: ws.id,
    originalText: text,
    provider: interp.provider,
    items: toResolve,
    actions: toResolve.map(() => null),
    inputKind: ctx.inputKind ?? "text",
  };
  const needsConfirm =
    toResolve.length > 1 ? "Confira os itens antes de gravar."
    : interp.provider !== "local" ? "Entendi com ajuda da IA — confira antes de gravar."
    : interp.confidence < CONFIDENT ? "Não tenho certeza de tudo — confira antes de gravar."
    : null;
  pending.reason = needsConfirm ?? undefined;
  return [...replies, ...(await advance(ctx, pending, lk, ws))];
}

/** Resolve os itens; pergunta o que faltar; confirma ou grava. */
async function advance(ctx: EngineCtx & { today: ISODate }, p: Pending, lk: Lookups, ws: Workspace): Promise<ChatReply[]> {
  for (let i = 0; i < p.items.length; i++) {
    if (p.actions[i]) continue;
    const r = resolveItem(p.items[i], lk, ctx.today);
    if (r.status === "error") {
      await savePending(ctx, null);
      return [{ text: r.message, tone: "warning" }];
    }
    if (r.status === "question") {
      p.items[i] = r.item;
      p.question = { index: i, q: r.question };
      await savePending(ctx, p);
      const prefix = p.items.length > 1 ? `Item ${i + 1}: ` : "";
      return [{ text: `${prefix}${r.question.text}`, tone: "info", question: { pendingId: p.id, options: r.question.options } }];
    }
    p.actions[i] = r.action;
  }
  p.question = undefined;
  const actions = p.actions as Action[];
  const big = actions.some((a) => a.amountCents > assistantConfig.confirmAboveCents);
  const reason = p.reason ?? (big ? `Valor acima de ${formatBRL(assistantConfig.confirmAboveCents)} — confirme para gravar.` : null);
  if (reason) {
    p.reason = reason;
    await savePending(ctx, p);
    return [{ text: reason, tone: "info", card: card(p, lk, ws, ctx.today) }];
  }
  return execute(ctx, p, lk, ws);
}

function card(p: Pending, lk: Lookups, ws: Workspace, today: ISODate): PendingCard {
  return {
    pendingId: p.id,
    reason: p.reason ?? "",
    workspaceName: ws.kind === "personal" ? "Individual" : ws.name,
    items: (p.actions as Action[]).map((a, index) => ({ ...describeAction(a, lk, today), index })),
    categories: lk.categories,
    media: p.media,
    extras: extrasOf(p),
  };
}

function extrasOf(p: Pending): Option[] {
  if (!p.alt?.split) return [];
  if (p.items.length === 1) {
    const parts = p.alt.split.map((i) => `${i.category ?? "Sem categoria"} ${formatBRL(i.amountCents ?? 0)}`).join(" + ");
    return [{ label: `Dividir por categoria (${parts})`, value: "split" }];
  }
  return [{ label: "Lançar como um único gasto", value: "single" }];
}

async function execute(ctx: EngineCtx & { today: ISODate }, p: Pending, lk: Lookups, ws: Workspace): Promise<ChatReply[]> {
  const batchId = uuid();
  const lines: string[] = [];
  let celebrate: string | undefined;
  for (const [i, a] of (p.actions as Action[]).entries()) {
    const intent = p.items[i]?.intent ?? "registrar_despesa";
    const res = await executeAction(ctx, ws.id, a, { channel: ctx.channel, originalText: p.originalText, batchId, provider: p.provider, intent, inputKind: p.inputKind ?? ctx.inputKind });
    if (!res.ok) {
      await savePending(ctx, null);
      const partial = lines.length ? ` (os ${lines.length} primeiros foram gravados; use “desfazer” se quiser)` : "";
      return [{ text: `${res.message}${partial}`, tone: "error", done: lines.length ? { batchId, lines, undoable: true } : undefined }];
    }
    if (res.data.achievedNow) celebrate = res.data.goalName;
    lines.push(summaryLine(describeAction(a, lk, ctx.today)));
  }
  await savePending(ctx, null);
  const where = ws.id !== ctx.activeWorkspaceId ? ` no espaço ${ws.kind === "personal" ? "individual" : `“${ws.name}”`}` : "";
  return [{
    text: celebrate ? `Meta “${celebrate}” concluída! 🎉` : `${lines.length > 1 ? `${lines.length} lançamentos gravados` : "Gravado"}${where}.`,
    tone: "success",
    done: { batchId, lines, undoable: true, celebrate },
  }];
}

async function confirm(ctx: EngineCtx & { today: ISODate }, p: Pending | null, id: string, edits: NonNullable<Extract<ChatInput, { kind: "confirm" }>["edits"]>): Promise<ChatReply[]> {
  if (!p || p.id !== id || p.actions.some((a) => !a)) return [{ text: "Essa confirmação expirou. Mande a mensagem de novo.", tone: "warning" }];
  const ws = ctx.workspaces.find((w) => w.id === p.workspaceId);
  if (!ws) return [{ text: "Você não participa mais desse espaço.", tone: "error" }];
  const { lk } = await loadLookups(ctx, ws.id);
  await applyEdits(ctx, p, lk, ws, edits);
  return execute(ctx, p, lk, ws);
}

async function applyEdits(ctx: EngineCtx & { today: ISODate }, p: Pending, lk: Lookups, ws: Workspace, edits: NonNullable<Extract<ChatInput, { kind: "confirm" }>["edits"]>) {
  for (const e of edits) {
    const a = p.actions[e.index];
    if (!a) continue;
    if (e.amountCents && e.amountCents > 0) a.amountCents = Math.round(e.amountCents);
    if (e.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
      if (a.type === "entry") a.occurredOn = e.date as ISODate;
      else a.contributedOn = e.date as ISODate;
    }
    if (a.type === "entry" && e.description !== undefined) a.description = e.description.trim().slice(0, 140) || null;
    if (a.type === "entry" && a.kind !== "transfer" && e.categoryId !== undefined && e.categoryId !== a.categoryId) {
      const cat = lk.categories.find((c) => c.id === e.categoryId && c.kind === a.kind);
      a.categoryId = cat?.id ?? null;
      // Correção de categoria vira regra do espaço ("padaria do zé" → Mercado).
      if (cat) await learnCategory(ctx, ws.id, a.description ?? p.items[e.index]?.description ?? null, cat.id);
    }
  }
}

const EDIT = /^(?:item\s*(\d)\s*[:,-]?\s*)?(valor|categoria|data|descricao)\s*[:=]?\s*(.+)$/;

/** "valor 45,90" · "categoria mercado" · "data ontem" · "item 2 valor 30" → atualiza o cartão (não grava). */
async function textEdit(ctx: EngineCtx & { today: ISODate }, p: Pending, raw: string, t: string): Promise<ChatReply[] | null> {
  const m = EDIT.exec(t);
  if (!m) return null;
  const index = m[1] ? Number(m[1]) - 1 : 0;
  const a = p.actions[index];
  const ws = ctx.workspaces.find((w) => w.id === p.workspaceId);
  if (!a || !ws) return [{ text: "Não achei esse item.", tone: "warning" }];
  const { lk } = await loadLookups(ctx, ws.id);
  const rest = m[3].trim();
  const edit: { index: number; amountCents?: number; categoryId?: string | null; date?: string; description?: string } = { index };
  if (m[2] === "valor") {
    const amount = findAmounts(rest)[0];
    if (!amount) return [{ text: "Não entendi o valor. Ex.: “valor 45,90”.", tone: "warning" }];
    edit.amountCents = amount.cents;
  } else if (m[2] === "categoria") {
    const kind = a.type === "entry" && a.kind === "income" ? "income" : "expense";
    const cat = lk.categories.find((c) => c.kind === kind && normalize(c.name) === rest)
      ?? lk.categories.find((c) => c.kind === kind && normalize(c.name).includes(rest));
    if (!cat) return [{ text: `Não achei a categoria “${rest}”.`, tone: "warning" }];
    edit.categoryId = cat.id;
  } else if (m[2] === "data") {
    const d = findDate(rest, ctx.today) ?? (/^hoje$/.test(rest) ? { date: ctx.today } : null);
    if (!d) return [{ text: "Não entendi a data. Ex.: “data ontem” ou “data 15/11”.", tone: "warning" }];
    edit.date = d.date;
  } else {
    edit.description = raw.replace(/^(item\s*\d\s*[:,-]?\s*)?descri[cç][aã]o\s*[:=]?\s*/i, "");
  }
  await applyEdits(ctx, p, lk, ws, [edit]);
  await savePending(ctx, p);
  return [{ text: "Atualizei. Confira e confirme:", tone: "info", card: card(p, lk, ws, ctx.today) }];
}

async function choose(ctx: EngineCtx & { today: ISODate }, p: Pending | null, id: string, value: string): Promise<ChatReply[]> {
  if (!p || p.id !== id) return [{ text: "Essa pergunta expirou. Mande a mensagem de novo.", tone: "warning" }];
  const ws = ctx.workspaces.find((w) => w.id === p.workspaceId);
  if (!ws) return [{ text: "Você não participa mais desse espaço.", tone: "error" }];
  if (p.confirmPick) {
    if (!p.confirmPick.options.some((o) => o.value === value)) return [{ text: "Opção inválida.", tone: "warning" }];
    await savePending(ctx, null);
    return confirmOne(ctx, ws, value, p.originalText, p.provider);
  }
  if ((value === "split" || value === "single") && p.alt) {
    const { lk } = await loadLookups(ctx, ws.id);
    p.items = value === "split" && p.alt.split ? p.alt.split.map((i) => ({ ...i })) : [{ ...p.alt.single }];
    p.actions = p.items.map(() => null);
    p.question = undefined;
    return advance(ctx, p, lk, ws);
  }
  if (!p.question) return [{ text: "Não há pergunta pendente.", tone: "warning" }];
  const { lk } = await loadLookups(ctx, ws.id);
  const { index, q } = p.question;
  if (q.options && !q.options.some((o) => o.value === value)) return [{ text: "Opção inválida.", tone: "warning" }];
  p.items[index] = applyAnswer(p.items[index], q.field, value, lk);
  p.actions[index] = null;
  p.question = undefined;
  return advance(ctx, p, lk, ws);
}

async function undo(ctx: EngineCtx, batchId?: string): Promise<ChatReply[]> {
  const res = await undoBatch(ctx, batchId);
  if (!res.ok) return [{ text: res.message, tone: "warning" }];
  return [{ text: res.data.count > 1 ? `Desfeito: ${res.data.count} registros apagados.` : "Desfeito: o último registro foi apagado.", tone: "success" }];
}

/** "paguei o aluguel": acha o PREVISTO correspondente e confirma (ou pergunta qual). */
async function findPlanned(ctx: EngineCtx & { today: ISODate }, ws: Workspace, lk: Lookups, item: ParsedItem, text: string, provider: Provider): Promise<ChatReply[]> {
  const words = normalize(item.description ?? "").split(" ").filter((w) => w.length >= 3);
  const income = /\b(recebi|caiu|entrou|chegou)\b/.test(normalize(text));
  const { data, error } = await ctx.supabase.from("transactions")
    .select("id, description, amount_cents, occurred_on, category:categories(name)")
    .eq("workspace_id", ws.id).eq("is_settled", false).eq("kind", income ? "income" : "expense")
    .gte("occurred_on", addDays(ctx.today, -45)).lte("occurred_on", addDays(ctx.today, 20))
    .order("occurred_on").limit(50);
  if (error) return [{ text: "Não consegui procurar os previstos agora.", tone: "error" }];
  const match = data.filter((t) => {
    const hay = normalize(`${t.description} ${t.category?.name ?? ""}`);
    return words.length > 0 && words.some((w) => hay.includes(w));
  });
  if (!match.length) {
    return [{ text: `Não achei ${income ? "receita" : "conta"} prevista com “${item.description ?? text}”. Se quiser registrar agora, diga o valor (ex.: “paguei 120 de luz”).`, tone: "warning" }];
  }
  if (match.length === 1) return confirmOne(ctx, ws, match[0].id, text, provider);
  const options = match.slice(0, 5).map((t) => ({ label: `${t.description} · ${formatBRL(t.amount_cents)} · ${t.occurred_on.slice(8, 10)}/${t.occurred_on.slice(5, 7)}`, value: t.id }));
  const p: Pending = { id: uuid(), workspaceId: ws.id, originalText: text, provider, items: [], actions: [], confirmPick: { options } };
  await savePending(ctx, p);
  return [{ text: "Qual deles você quer marcar como pago/recebido?", tone: "info", question: { pendingId: p.id, options } }];
}

async function confirmOne(ctx: EngineCtx & { today: ISODate }, ws: Workspace, transactionId: string, text: string, provider: Provider): Promise<ChatReply[]> {
  const batchId = uuid();
  const { data } = await ctx.supabase.from("transactions").select("description, amount_cents, kind").eq("id", transactionId).maybeSingle();
  const res = await confirmPlanned(ctx, ws.id, transactionId, { channel: ctx.channel, originalText: text, batchId, provider, intent: "confirmar_previsto", inputKind: ctx.inputKind });
  if (!res.ok) return [{ text: res.message, tone: "error" }];
  const line = data ? `${data.description} · ${formatBRL(data.amount_cents)} marcado como ${data.kind === "income" ? "recebido" : "pago"}` : "Previsto confirmado";
  return [{ text: `${line}.`, tone: "success", done: { batchId, lines: [line], undoable: true } }];
}

// =============================================================================
// Fase 6 — FOTO (comprovante) e ÁUDIO. Mesmo fluxo de confirmação do texto.
// A imagem/áudio só existe nesta chamada (memória) e é descartada (ADR-0022).
// =============================================================================

const bytesOf = (b64: string) => Math.floor((b64.length * 3) / 4);

async function takeMediaQuota(ctx: EngineCtx, provider: "gemini-image" | "groq-audio" | "gemini-audio", limit: number) {
  const { data, error } = await ctx.supabase.rpc("assistant_take_quota", {
    p_provider: provider, p_daily_limit: limit, p_per_minute: assistantConfig.perMinute,
  }).single();
  if (error || !data) return { allowed: false, reason: "erro-cota" };
  return { allowed: data.allowed, reason: data.reason };
}

function quotaMessage(reason: string | null | undefined, what: "fotos" | "áudios", limit: number): ChatReply[] {
  return [{
    text: reason === "daily_limit"
      ? `Você chegou ao limite de ${limit} ${what} por dia. Amanhã libera de novo — por texto continua funcionando.`
      : "Muitas mensagens em sequência. Espere um minuto e tente de novo.",
    tone: "warning",
  }];
}

function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fn(ctrl.signal).finally(() => clearTimeout(timer));
}

async function findDuplicate(ctx: EngineCtx & { today: ISODate }, workspaceId: string, r: Receipt): Promise<string | null> {
  const day = r.date ?? ctx.today;
  const { data } = await ctx.supabase.from("transactions")
    .select("description, occurred_on")
    .eq("workspace_id", workspaceId).eq("amount_cents", r.totalCents)
    .gte("occurred_on", addDays(day, -2)).lte("occurred_on", addDays(day, 2))
    .limit(1);
  const t = data?.[0];
  return t ? `“${t.description}” de ${t.occurred_on.split("-").reverse().join("/")} com o mesmo valor` : null;
}

async function fromImage(ctx: EngineCtx & { today: ISODate }, img: Extract<ChatInput, { kind: "image" }>): Promise<ChatReply[]> {
  if (bytesOf(img.base64) > assistantConfig.maxImageBytes) {
    return [{ text: "Imagem muito grande. Mande uma foto menor ou um print da tela.", tone: "warning" }];
  }
  const providers = (ctx.providers ?? defaultProviders()).filter((p) => p.extractReceipt && p.supportsImages && p.available());
  if (!providers.length) return [{ text: "A leitura de fotos precisa da IA (Gemini), que não está configurada no servidor.", tone: "warning" }];
  const active = ctx.workspaces.find((w) => w.id === ctx.activeWorkspaceId) ?? ctx.workspaces[0];
  const { lk, names } = await loadLookups(ctx, active.id);

  let raw: unknown = null;
  let provider: Provider = "local";
  for (const p of providers) {
    if (p.name !== "mock") {
      const q = await takeMediaQuota(ctx, "gemini-image", assistantConfig.photoDailyLimit);
      if (!q.allowed) return quotaMessage(q.reason, "fotos", assistantConfig.photoDailyLimit);
    }
    try {
      raw = await withTimeout((signal) => p.extractReceipt!({ image: { mimeType: img.mimeType, base64: img.base64 }, nowLocal: nowLocal(), names }, signal), 25_000);
      provider = p.name;
      break;
    } catch (e) {
      console.warn(`assistente: leitura de foto falhou (${p.name}): ${e instanceof Error ? e.message : "erro"}`);
    }
  }
  if (raw == null) return [{ text: "Não consegui ler a foto agora (a IA não respondeu). Tente de novo em instantes.", tone: "error" }];

  const parsed = receiptSchema.safeParse(raw);
  if (!parsed.success) return [{ text: PHOTO_TIPS, tone: "warning" }];
  const v = validateReceipt(parsed.data, ctx.today, names);
  if (!v.ok) {
    return [{
      text: v.reason === "no_total" ? `Li a imagem, mas não achei o valor total. ${PHOTO_TIPS.split(". ").slice(1).join(". ")}` : PHOTO_TIPS,
      tone: "warning",
    }];
  }
  const r = v.receipt;
  const single = receiptToItem(r);
  if (r.cardLast4) {
    const cardRow = lk.cards.find((c) => c.last4 === r.cardLast4);
    if (cardRow) {
      single.card = cardRow.name;
      single.payment = "credit";
    } else r.warnings.push(`Cartão final ${r.cardLast4} não está cadastrado — escolha onde lançar.`);
  }
  const dup = await findDuplicate(ctx, active.id, r);
  if (dup) r.warnings.push(`Possível duplicata: já existe ${dup}.`);

  const split = splitByCategory(r)?.map((i) => ({ ...i, card: single.card, payment: single.payment })) ?? null;
  const read = [
    `📷 Li: ${DOC_LABEL[r.docType]}${r.merchant ? ` · ${r.merchant}` : ""}`,
    `Total ${formatBRL(r.totalCents)}${r.date ? ` · ${r.date.split("-").reverse().join("/")}` : ""}${r.items.length ? ` · ${r.items.length} ${r.items.length === 1 ? "item" : "itens"}` : ""}`,
    ...r.warnings.map((w) => `⚠️ ${w}`),
  ].join("\n");
  const pending: Pending = {
    id: uuid(),
    workspaceId: active.id,
    originalText: receiptSummary(r),
    provider,
    items: [single],
    actions: [null],
    inputKind: "photo",
    alt: { single, split },
    media: { summary: read, warnings: r.warnings },
    // Foto SEMPRE pede confirmação.
    reason: "Li esta foto — confira antes de gravar.",
  };
  const next = await advance({ ...ctx, inputKind: "photo" }, pending, lk, active);
  // Se o próximo passo for pergunta (ex.: qual conta), mostra antes o que foi lido.
  return next[0]?.card ? next : [{ text: read, tone: "info" }, ...next];
}

async function fromAudio(ctx: EngineCtx & { today: ISODate }, audio: Extract<ChatInput, { kind: "audio" }>): Promise<ChatReply[]> {
  if ((audio.seconds ?? 0) > assistantConfig.maxAudioSeconds) {
    return [{ text: `Áudio longo demais (máx. ${assistantConfig.maxAudioSeconds} s). Mande um áudio curto, uma frase por gasto.`, tone: "warning" }];
  }
  if (bytesOf(audio.base64) > assistantConfig.maxAudioBytes) return [{ text: "Áudio grande demais. Mande um áudio mais curto.", tone: "warning" }];
  // Whisper (Groq) primeiro: mais rápido e preciso para transcrição; Gemini é a reserva.
  const providers = (ctx.providers ?? defaultProviders())
    .filter((p) => p.transcribe && p.available())
    .sort((a, b) => (a.name === "groq" ? -1 : b.name === "groq" ? 1 : 0));
  if (!providers.length) return [{ text: "A transcrição de áudio precisa da IA (Groq ou Gemini), que não está configurada.", tone: "warning" }];

  let transcript = "";
  for (const p of providers) {
    if (p.name !== "mock") {
      const q = await takeMediaQuota(ctx, p.name === "groq" ? "groq-audio" : "gemini-audio", assistantConfig.audioDailyLimit);
      if (!q.allowed) {
        if (q.reason === "daily_limit") continue; // tenta o outro provedor
        return quotaMessage(q.reason, "áudios", assistantConfig.audioDailyLimit);
      }
    }
    try {
      transcript = await withTimeout((signal) => p.transcribe!({ mimeType: audio.mimeType, base64: audio.base64, filename: audio.filename ?? "audio" }, signal), 15_000);
      if (transcript) break;
    } catch (e) {
      console.warn(`assistente: transcrição falhou (${p.name}): ${e instanceof Error ? e.message : "erro"}`);
    }
  }
  transcript = transcript.replace(/\s+/g, " ").trim().slice(0, 500);
  if (!transcript) return [{ text: "Não consegui entender o áudio. Pode repetir mais perto do microfone ou escrever?", tone: "warning" }];
  // Segue o fluxo normal (inclusive responder "sim"/"1" por voz a uma pergunta pendente).
  const replies = await handleAssistant({ ...ctx, inputKind: "audio" }, { kind: "text", text: transcript });
  return [{ text: `Entendi: “${transcript}”`, tone: "info", transcript }, ...replies];
}
