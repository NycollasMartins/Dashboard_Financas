import "server-only";
import { dbErrorMessage } from "@/lib/errors";
import { failure, fieldErrorsOf, type Ctx, type Result } from "@/lib/service-result";
import type { Database } from "@/lib/supabase/database.types";
import { entrySchema } from "@/lib/validation/ledger";

/*
 * API INTERNA DE LANÇAMENTOS (Fase 5). As telas (Server Actions) e o
 * assistente usam as MESMAS funções — nenhuma regra duplicada.
 * Documentação: docs/api-interna.md.
 */

export type Source = Database["public"]["Enums"]["entry_source"];
export type EntryResult = {
  id: string;
  table: "transactions" | "transfers";
  /** Compra parcelada: desfazer apaga o plano inteiro a partir deste lançamento. */
  installmentPlan: boolean;
  message: string;
};

/** Cria ou edita receita, despesa, compra no cartão (à vista/parcelada) ou transferência. */
export async function registrarLancamento(ctx: Ctx, input: unknown, opts: { source?: Source } = {}): Promise<Result<EntryResult>> {
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return failure("Confira os campos destacados.", fieldErrorsOf(parsed.error));
  const v = parsed.data;
  const source = opts.source ?? "manual";
  const sb = ctx.supabase;

  if (v.kind === "transfer") {
    const row = {
      workspace_id: v.workspaceId,
      from_account_id: v.accountId!,
      to_account_id: v.toAccountId!,
      amount_cents: v.amountCents,
      occurred_on: v.occurredOn,
      description: v.description ?? null,
    };
    const res = v.id
      ? await sb.from("transfers").update(row).eq("id", v.id).select("id").single()
      : await sb.from("transfers").insert(row).select("id").single();
    if (res.error) return failure(dbErrorMessage(res.error, "Não foi possível salvar a transferência."));
    return { ok: true, data: { id: res.data.id, table: "transfers", installmentPlan: false, message: "Transferência salva." } };
  }

  let description = v.description;
  if (!description && v.categoryId) {
    const { data } = await sb.from("categories").select("name").eq("id", v.categoryId).maybeSingle();
    description = data?.name;
  }
  description ??= v.kind === "income" ? "Receita" : "Despesa";

  if (!v.id && v.paymentMethod === "credit") {
    const { data, error } = await sb.rpc("create_card_purchase", {
      p_workspace_id: v.workspaceId,
      p_card_id: v.cardId!,
      p_total_cents: v.amountCents,
      p_installments: v.installments,
      p_description: description,
      p_occurred_on: v.occurredOn,
      p_category_id: v.categoryId,
      p_member_user_id: v.memberUserId,
      p_notes: v.notes,
      p_source: source,
    });
    if (error || !data) return failure(dbErrorMessage(error, "Não foi possível salvar a compra."));
    return {
      ok: true,
      data: {
        id: data,
        table: "transactions",
        installmentPlan: v.installments > 1,
        message: v.installments > 1 ? `Compra em ${v.installments}x registrada.` : "Compra no cartão registrada.",
      },
    };
  }

  const row = {
    workspace_id: v.workspaceId,
    kind: v.kind,
    amount_cents: v.amountCents,
    description,
    occurred_on: v.occurredOn,
    category_id: v.categoryId ?? null,
    payment_method: v.paymentMethod,
    account_id: v.paymentMethod === "credit" ? null : (v.accountId ?? null),
    card_id: v.paymentMethod === "credit" ? v.cardId! : null,
    member_user_id: v.memberUserId ?? null,
    notes: v.notes ?? null,
    is_settled: v.isSettled,
  };

  if (v.id) {
    const { data, error } = await sb.from("transactions").update(row).eq("id", v.id).select("id");
    if (error || !data?.length) return failure(dbErrorMessage(error, "Você só pode editar lançamentos que criou (ou ser admin)."));
    return { ok: true, data: { id: v.id, table: "transactions", installmentPlan: false, message: "Lançamento atualizado." } };
  }
  const { data, error } = await sb.from("transactions").insert({ ...row, source }).select("id").single();
  if (error) return failure(dbErrorMessage(error, "Não foi possível salvar o lançamento."));
  return {
    ok: true,
    data: { id: data.id, table: "transactions", installmentPlan: false, message: v.kind === "income" ? "Receita registrada." : "Despesa registrada." },
  };
}

/** Exclui um lançamento ou transferência (lançamento pode ser restaurado por 24 h). */
export async function excluirLancamento(ctx: Ctx, table: "transactions" | "transfers", id: string): Promise<Result<null>> {
  const { data, error } = await ctx.supabase.from(table).delete().eq("id", id).select("id");
  if (error || !data?.length) return failure(dbErrorMessage(error, "Você só pode excluir lançamentos que criou (ou ser admin)."));
  return { ok: true, data: null };
}

/** Apaga todas as parcelas de uma compra a partir de qualquer parcela. */
export async function excluirCompraParcelada(ctx: Ctx, transactionId: string): Promise<Result<number>> {
  const { data, error } = await ctx.supabase.rpc("delete_installments", { p_transaction_id: transactionId, p_scope: "all" });
  if (error) return failure(dbErrorMessage(error, "Não foi possível excluir as parcelas."));
  return { ok: true, data: data ?? 0 };
}

/** Marca um previsto como pago/recebido (ou desfaz: settled = false). */
export async function confirmarLancamento(ctx: Ctx, id: string, settled = true): Promise<Result<null>> {
  const { data, error } = await ctx.supabase.from("transactions").update({ is_settled: settled }).eq("id", id).select("id");
  if (error || !data?.length) return failure(dbErrorMessage(error, "Não foi possível atualizar o lançamento."));
  return { ok: true, data: null };
}
