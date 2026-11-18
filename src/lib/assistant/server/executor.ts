import "server-only";
import { registrarAporte, excluirAporte } from "@/lib/goals/service";
import { confirmarLancamento, excluirCompraParcelada, excluirLancamento, registrarLancamento } from "@/lib/ledger/service";
import type { Ctx, Result } from "@/lib/service-result";
import { normalize } from "../normalize";
import type { Action } from "../resolver";
import type { Provider } from "../types";

/*
 * EXECUTOR: a única parte do assistente que grava — e SEMPRE pelas APIs
 * internas (as mesmas das telas), com origem "assistant". Cada gravação gera
 * uma linha em assistant_actions com a mensagem original (auditada).
 */

export type Channel = "app" | "whatsapp" | "telegram";
export type InputKind = "text" | "photo" | "audio";
export type ExecMeta = { channel: Channel; originalText: string; batchId: string; provider: Provider | "form"; intent: string; inputKind?: InputKind };

async function logAction(ctx: Ctx, workspaceId: string, meta: ExecMeta, table: string, recordId: string, undoKind: "delete" | "unsettle" | "delete_plan") {
  const { error } = await ctx.supabase.from("assistant_actions").insert({
    workspace_id: workspaceId,
    channel: meta.channel,
    batch_id: meta.batchId,
    intent: meta.intent,
    original_text: meta.originalText.slice(0, 4096),
    record_table: table,
    record_id: recordId,
    undo_kind: undoKind,
    provider: meta.provider,
    input_kind: meta.inputKind ?? "text",
  });
  if (error) throw error;
}

export async function executeAction(ctx: Ctx, workspaceId: string, a: Action, meta: ExecMeta): Promise<Result<{ achievedNow?: boolean; goalName?: string }>> {
  if (a.type === "goal") {
    const res = await registrarAporte(ctx, {
      workspaceId, goalId: a.goalId, kind: a.kind, amountCents: a.amountCents, contributedOn: a.contributedOn,
      accountId: a.accountId ?? undefined, note: a.note ?? undefined, source: "assistant",
    });
    if (!res.ok) return res;
    await logAction(ctx, workspaceId, meta, "goal_contributions", res.data.id, "delete");
    return { ok: true, data: { achievedNow: res.data.achievedNow, goalName: res.data.goal.name } };
  }
  const res = await registrarLancamento(ctx, {
    workspaceId, kind: a.kind, amountCents: a.amountCents, description: a.description ?? undefined, occurredOn: a.occurredOn,
    categoryId: a.categoryId ?? undefined, paymentMethod: a.paymentMethod, accountId: a.accountId ?? undefined,
    toAccountId: a.toAccountId ?? undefined, cardId: a.cardId ?? undefined, installments: a.installments,
  }, { source: "assistant" });
  if (!res.ok) return res;
  await logAction(ctx, workspaceId, meta, res.data.table, res.data.id, res.data.installmentPlan ? "delete_plan" : "delete");
  return { ok: true, data: {} };
}

/** Confirma um previsto ("paguei o aluguel") e registra para poder desfazer. */
export async function confirmPlanned(ctx: Ctx, workspaceId: string, transactionId: string, meta: ExecMeta): Promise<Result<null>> {
  const res = await confirmarLancamento(ctx, transactionId, true);
  if (!res.ok) return res;
  await logAction(ctx, workspaceId, meta, "transactions", transactionId, "unsettle");
  return { ok: true, data: null };
}

/** Desfaz o último lote do usuário (ou um lote específico) feito pelo assistente nas últimas 24 h. */
export async function undoBatch(ctx: Ctx, batchId?: string): Promise<Result<{ count: number }>> {
  let q = ctx.supabase.from("assistant_actions").select("id, batch_id, record_table, record_id, undo_kind")
    .eq("user_id", ctx.userId).is("undone_at", null).gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if (batchId) q = q.eq("batch_id", batchId);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(20);
  if (error) return { ok: false, message: "Não consegui desfazer agora." };
  if (!data.length) return { ok: false, message: "Não há nada recente feito pelo assistente para desfazer." };
  const batch = batchId ?? data[0].batch_id;
  const rows = data.filter((r) => r.batch_id === batch);
  for (const r of rows) {
    const res =
      r.undo_kind === "unsettle" ? await confirmarLancamento(ctx, r.record_id, false)
      : r.undo_kind === "delete_plan" ? await excluirCompraParcelada(ctx, r.record_id)
      : r.record_table === "goal_contributions" ? await excluirAporte(ctx, r.record_id)
      : await excluirLancamento(ctx, r.record_table as "transactions" | "transfers", r.record_id);
    if (!res.ok) return res;
  }
  await ctx.supabase.from("assistant_actions").update({ undone_at: new Date().toISOString() }).in("id", rows.map((r) => r.id));
  return { ok: true, data: { count: rows.length } };
}

/** Aprende: "padaria do zé" → categoria escolhida pela pessoa (vale para o espaço todo). */
export async function learnCategory(ctx: Ctx, workspaceId: string, description: string | null, categoryId: string) {
  const pattern = normalize(description ?? "").replace(/\d+([.,]\d+)?/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (pattern.length < 2) return;
  await ctx.supabase.from("category_rules").upsert({ workspace_id: workspaceId, pattern, category_id: categoryId }, { onConflict: "workspace_id,pattern" });
}
