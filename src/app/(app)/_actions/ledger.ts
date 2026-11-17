"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth/session";
import { dbErrorMessage } from "@/lib/errors";
import { formToObject } from "@/lib/form-data";
import { createClient } from "@/lib/supabase/server";
import {
  accountSchema,
  cardSchema,
  categorySchema,
  entrySchema,
  invoicePaymentSchema,
  recurrenceSchema,
  scopeSchema,
} from "@/lib/validation/ledger";
import { uuidSchema } from "@/lib/validation/workspace";

/*
 * Server Actions da Fase 2. Padrão: Zod → requireUser → cliente do usuário
 * (RLS decide permissões) → mensagens em pt-BR → revalidate.
 */

const flat = (e: z.ZodError) => z.flattenError(e).fieldErrors as Record<string, string[] | undefined>;

function refresh() {
  revalidatePath("/", "layout");
}

// -----------------------------------------------------------------------------
// Lançamentos (receita, despesa, transferência, compra no cartão)
// -----------------------------------------------------------------------------
export async function saveEntryAction(
  _prev: ActionState<{ id: string }>,
  formData: FormData,
): Promise<ActionState<{ id: string }>> {
  const raw = formToObject(formData);
  const parsed = entrySchema.safeParse(raw);
  if (!parsed.success) return fail("Confira os campos destacados.", flat(parsed.error), raw);
  const v = parsed.data;

  await requireUser();
  const supabase = await createClient();

  // Transferência entre contas
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
      ? await supabase.from("transfers").update(row).eq("id", v.id).select("id").single()
      : await supabase.from("transfers").insert(row).select("id").single();
    if (res.error) return fail(dbErrorMessage(res.error, "Não foi possível salvar a transferência."), undefined, raw);
    refresh();
    return ok("Transferência salva.", { id: res.data.id });
  }

  const description = v.description ?? (await categoryName(v.categoryId)) ?? (v.kind === "income" ? "Receita" : "Despesa");

  // Nova compra no cartão (à vista ou parcelada): RPC calcula faturas e parcelas.
  if (!v.id && v.paymentMethod === "credit") {
    const { data, error } = await supabase.rpc("create_card_purchase", {
      p_workspace_id: v.workspaceId,
      p_card_id: v.cardId!,
      p_total_cents: v.amountCents,
      p_installments: v.installments,
      p_description: description,
      p_occurred_on: v.occurredOn,
      p_category_id: v.categoryId,
      p_member_user_id: v.memberUserId,
      p_notes: v.notes,
    });
    if (error || !data) return fail(dbErrorMessage(error, "Não foi possível salvar a compra."), undefined, raw);
    refresh();
    return ok(v.installments > 1 ? `Compra em ${v.installments}x registrada.` : "Compra no cartão registrada.", { id: data });
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
    const { data, error } = await supabase.from("transactions").update(row).eq("id", v.id).select("id");
    if (error || !data?.length) {
      return fail(dbErrorMessage(error, "Você só pode editar lançamentos que criou (ou ser admin)."), undefined, raw);
    }
    refresh();
    return ok("Lançamento atualizado.", { id: v.id });
  }

  const { data, error } = await supabase.from("transactions").insert(row).select("id").single();
  if (error) return fail(dbErrorMessage(error, "Não foi possível salvar o lançamento."), undefined, raw);
  refresh();
  return ok(v.kind === "income" ? "Receita registrada." : "Despesa registrada.", { id: data.id });
}

async function categoryName(id?: string) {
  if (!id) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("name").eq("id", id).maybeSingle();
  return data?.name ?? null;
}

export async function deleteEntryAction(
  type: "transaction" | "transfer",
  id: string,
): Promise<ActionState<{ undo: boolean }>> {
  if (!uuidSchema.safeParse(id).success) return fail("Lançamento inválido.");
  await requireUser();
  const supabase = await createClient();
  const table = type === "transfer" ? "transfers" : "transactions";
  const { data, error } = await supabase.from(table).delete().eq("id", id).select("id");
  if (error || !data?.length) {
    return fail(dbErrorMessage(error, "Você só pode excluir lançamentos que criou (ou ser admin)."));
  }
  refresh();
  return ok("Lançamento excluído.", { undo: type === "transaction" });
}

export async function restoreEntryAction(id: string): Promise<ActionState> {
  if (!uuidSchema.safeParse(id).success) return fail("Lançamento inválido.");
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_deleted_transaction", { p_transaction_id: id });
  if (error) return fail(dbErrorMessage(error, "Não foi possível desfazer."));
  refresh();
  return ok("Exclusão desfeita.");
}

export async function deleteInstallmentsAction(id: string, scope: string): Promise<ActionState> {
  const input = z.object({ id: uuidSchema, scope: scopeSchema }).safeParse({ id, scope });
  if (!input.success) return fail("Dados inválidos.");
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_installments", {
    p_transaction_id: input.data.id,
    p_scope: input.data.scope,
  });
  if (error) return fail(dbErrorMessage(error, "Não foi possível excluir as parcelas."));
  refresh();
  return ok(data === 1 ? "Parcela excluída." : `${data} parcelas excluídas.`);
}

export async function updateInstallmentsAction(
  id: string,
  scope: string,
  fields: { description: string; categoryId: string | null; notes: string | null; memberUserId: string | null },
): Promise<ActionState> {
  const input = z
    .object({
      id: uuidSchema,
      scope: scopeSchema,
      description: z.string().trim().min(1).max(140),
      categoryId: uuidSchema.nullable(),
      notes: z.string().max(500).nullable(),
      memberUserId: uuidSchema.nullable(),
    })
    .safeParse({ id, scope, ...fields });
  if (!input.success) return fail("Dados inválidos.");
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_installments", {
    p_transaction_id: input.data.id,
    p_scope: input.data.scope,
    p_description: input.data.description,
    p_category_id: input.data.categoryId as string,
    p_notes: input.data.notes as string,
    p_member_user_id: input.data.memberUserId as string,
  });
  if (error) return fail(dbErrorMessage(error, "Não foi possível atualizar as parcelas."));
  refresh();
  return ok("Parcelas atualizadas.");
}

export async function confirmEntryAction(id: string): Promise<ActionState> {
  if (!uuidSchema.safeParse(id).success) return fail("Lançamento inválido.");
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("transactions").update({ is_settled: true }).eq("id", id).select("id");
  if (error || !data?.length) return fail(dbErrorMessage(error, "Não foi possível confirmar."));
  refresh();
  return ok("Lançamento confirmado.");
}

// -----------------------------------------------------------------------------
// Cartões e faturas
// -----------------------------------------------------------------------------
export async function saveCardAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formToObject(formData);
  const parsed = cardSchema.safeParse(raw);
  if (!parsed.success) return fail("Confira os campos.", flat(parsed.error), raw);
  const v = parsed.data;
  await requireUser();
  const supabase = await createClient();
  const row = {
    workspace_id: v.workspaceId,
    name: v.name,
    brand: v.brand ?? null,
    last4: v.last4 ?? null,
    limit_cents: v.limitCents ?? null,
    closing_day: v.closingDay,
    due_day: v.dueDay,
    color: v.color,
  };
  const { error } = v.id
    ? await supabase.from("credit_cards").update(row).eq("id", v.id)
    : await supabase.from("credit_cards").insert(row);
  if (error) return fail(dbErrorMessage(error, "Não foi possível salvar o cartão."), undefined, raw);
  refresh();
  return ok(v.id ? "Cartão atualizado." : "Cartão cadastrado.");
}

export async function archiveCardAction(id: string): Promise<ActionState> {
  if (!uuidSchema.safeParse(id).success) return fail("Cartão inválido.");
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("credit_cards")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return fail(dbErrorMessage(error, "Não foi possível arquivar o cartão."));
  refresh();
  return ok("Cartão arquivado. O histórico continua nos lançamentos.");
}

export async function payInvoiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formToObject(formData);
  const parsed = invoicePaymentSchema.safeParse(raw);
  if (!parsed.success) return fail("Confira os campos.", flat(parsed.error), raw);
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("invoice_payments").insert({
    workspace_id: parsed.data.workspaceId,
    invoice_id: parsed.data.invoiceId,
    account_id: parsed.data.accountId ?? null,
    amount_cents: parsed.data.amountCents,
    paid_on: parsed.data.paidOn,
  });
  if (error) return fail(dbErrorMessage(error, "Não foi possível registrar o pagamento."), undefined, raw);
  refresh();
  return ok("Pagamento registrado.");
}

export async function deleteInvoicePaymentAction(id: string): Promise<ActionState> {
  if (!uuidSchema.safeParse(id).success) return fail("Pagamento inválido.");
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("invoice_payments").delete().eq("id", id).select("id");
  if (error || !data?.length) return fail(dbErrorMessage(error, "Não foi possível excluir o pagamento."));
  refresh();
  return ok("Pagamento excluído.");
}

// -----------------------------------------------------------------------------
// Contas
// -----------------------------------------------------------------------------
export async function saveAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formToObject(formData);
  const parsed = accountSchema.safeParse(raw);
  if (!parsed.success) return fail("Confira os campos.", flat(parsed.error), raw);
  const v = parsed.data;
  await requireUser();
  const supabase = await createClient();
  const row = {
    workspace_id: v.workspaceId,
    name: v.name,
    type: v.type,
    institution: v.institution ?? null,
    initial_balance_cents: v.initialBalanceCents,
    color: v.color,
  };
  const { error } = v.id
    ? await supabase.from("accounts").update(row).eq("id", v.id)
    : await supabase.from("accounts").insert(row);
  if (error) return fail(dbErrorMessage(error, "Não foi possível salvar a conta."), undefined, raw);
  refresh();
  return ok(v.id ? "Conta atualizada." : "Conta criada.");
}

export async function archiveAccountAction(id: string): Promise<ActionState> {
  if (!uuidSchema.safeParse(id).success) return fail("Conta inválida.");
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return fail(dbErrorMessage(error, "Não foi possível arquivar a conta."));
  refresh();
  return ok("Conta arquivada.");
}

// -----------------------------------------------------------------------------
// Categorias
// -----------------------------------------------------------------------------
export async function saveCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formToObject(formData);
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return fail("Confira os campos.", flat(parsed.error), raw);
  const v = parsed.data;
  await requireUser();
  const supabase = await createClient();
  const row = {
    workspace_id: v.workspaceId,
    kind: v.kind,
    name: v.name,
    icon: v.icon,
    color: v.color,
    parent_id: v.parentId ?? null,
  };
  const { error } = v.id
    ? await supabase.from("categories").update(row).eq("id", v.id)
    : await supabase.from("categories").insert(row);
  if (error) {
    const msg = error.code === "23505" ? "Já existe uma categoria com esse nome." : dbErrorMessage(error);
    return fail(msg, error.code === "23505" ? { name: [msg] } : undefined, raw);
  }
  refresh();
  return ok(v.id ? "Categoria atualizada." : "Categoria criada.");
}

export async function deleteCategoryAction(id: string, reassignTo: string | null): Promise<ActionState> {
  const input = z.object({ id: uuidSchema, reassignTo: uuidSchema.nullable() }).safeParse({ id, reassignTo });
  if (!input.success) return fail("Dados inválidos.");
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_category", {
    p_category_id: input.data.id,
    p_reassign_to: input.data.reassignTo ?? undefined,
  });
  if (error) return fail(dbErrorMessage(error, "Não foi possível excluir a categoria."));
  refresh();
  return ok("Categoria excluída.");
}

// -----------------------------------------------------------------------------
// Recorrências
// -----------------------------------------------------------------------------
export async function saveRecurrenceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formToObject(formData);
  const parsed = recurrenceSchema.safeParse(raw);
  if (!parsed.success) return fail("Confira os campos.", flat(parsed.error), raw);
  const v = parsed.data;
  await requireUser();
  const supabase = await createClient();
  const row = {
    workspace_id: v.workspaceId,
    kind: v.kind,
    description: v.description,
    amount_cents: v.amountCents,
    category_id: v.categoryId ?? null,
    payment_method: v.paymentMethod,
    account_id: v.paymentMethod === "credit" ? null : (v.accountId ?? null),
    card_id: v.paymentMethod === "credit" ? v.cardId! : null,
    member_user_id: v.memberUserId ?? null,
    frequency: v.frequency,
    day_of_month: v.dayOfMonth,
    starts_on: v.startsOn,
    ends_on: v.endsOn ?? null,
    auto_confirm: v.autoConfirm,
  };

  if (!v.id) {
    const { error } = await supabase.from("recurrences").insert(row);
    if (error) return fail(dbErrorMessage(error, "Não foi possível criar a recorrência."), undefined, raw);
    refresh();
    return ok("Recorrência criada. Os lançamentos deste mês já aparecem como previstos.");
  }

  const { data, error } = await supabase.from("recurrences").update(row).eq("id", v.id).select("id");
  if (error || !data?.length) {
    return fail(dbErrorMessage(error, "Você só pode editar recorrências que criou (ou ser admin)."), undefined, raw);
  }
  if (v.applyToFuture) {
    const res = await supabase.rpc("apply_recurrence_to_future", { p_recurrence_id: v.id });
    if (res.error) return fail(dbErrorMessage(res.error, "Recorrência salva, mas os previstos não foram atualizados."));
  }
  refresh();
  return ok(v.applyToFuture ? "Recorrência e lançamentos previstos atualizados." : "Recorrência atualizada.");
}

export async function toggleRecurrenceAction(id: string, active: boolean): Promise<ActionState> {
  if (!uuidSchema.safeParse(id).success) return fail("Recorrência inválida.");
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("recurrences").update({ is_active: active }).eq("id", id).select("workspace_id");
  if (error || !data?.length) return fail(dbErrorMessage(error, "Não foi possível alterar a recorrência."));
  if (active) await supabase.rpc("generate_workspace_recurrences", { p_workspace_id: data[0].workspace_id });
  refresh();
  return ok(active ? "Recorrência reativada." : "Recorrência pausada.");
}

export async function deleteRecurrenceAction(id: string, removeFuture: boolean): Promise<ActionState> {
  if (!uuidSchema.safeParse(id).success) return fail("Recorrência inválida.");
  await requireUser();
  const supabase = await createClient();
  if (removeFuture) {
    // Remove só os PREVISTOS a partir de hoje; confirmados ficam no histórico.
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    await supabase.from("transactions").delete().eq("recurrence_id", id).eq("is_settled", false).gte("recurrence_date", today);
  }
  const { data, error } = await supabase.from("recurrences").delete().eq("id", id).select("id");
  if (error || !data?.length) return fail(dbErrorMessage(error, "Não foi possível excluir a recorrência."));
  refresh();
  return ok("Recorrência excluída. Lançamentos confirmados continuam no histórico.");
}
