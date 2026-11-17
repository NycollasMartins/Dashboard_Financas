import "server-only";
import type { DateRange } from "@/lib/analytics/period";
import type { Basis } from "@/lib/domain/basis";
import { createClient } from "@/lib/supabase/server";

/*
 * Consultas do dashboard (Fase 3). Toda a agregação acontece no banco, nas
 * funções public.analytics_* (SECURITY INVOKER → RLS de quem está logado).
 * Aqui só chamamos as RPCs e convertemos nomes para camelCase.
 */

export type AnalyticsScope = {
  workspaceId: string;
  basis: Basis;
  categoryId?: string;
  memberId?: string;
  accountId?: string;
  cardId?: string;
};

function args(scope: AnalyticsScope, range: DateRange) {
  return {
    p_workspace_id: scope.workspaceId,
    p_from: range.from,
    p_to: range.to,
    p_basis: scope.basis,
    p_category_id: scope.categoryId,
    p_member_id: scope.memberId,
    p_account_id: scope.accountId,
    p_card_id: scope.cardId,
  };
}

export type Totals = {
  incomeCents: number;
  incomePlannedCents: number;
  expenseCents: number;
  expensePlannedCents: number;
  entries: number;
};

export async function getTotals(scope: AnalyticsScope, range: DateRange): Promise<Totals> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("analytics_totals", args(scope, range)).single();
  if (error) throw error;
  return {
    incomeCents: data.income_cents,
    incomePlannedCents: data.income_planned_cents,
    expenseCents: data.expense_cents,
    expensePlannedCents: data.expense_planned_cents,
    entries: data.entries,
  };
}

export type MonthPoint = Totals & { month: string };

export async function getMonthly(scope: AnalyticsScope, range: DateRange): Promise<MonthPoint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("analytics_monthly", args(scope, range));
  if (error) throw error;
  return data.map((r) => ({
    month: r.month,
    incomeCents: r.income_cents,
    incomePlannedCents: r.income_planned_cents,
    expenseCents: r.expense_cents,
    expensePlannedCents: r.expense_planned_cents,
    entries: 0,
  }));
}

export async function getByCategory(scope: AnalyticsScope, range: DateRange, kind: "expense" | "income" = "expense") {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("analytics_by_category", { ...args(scope, range), p_kind: kind });
  if (error) throw error;
  return data.map((r) => ({
    categoryId: r.category_id as string | null,
    parentId: r.parent_id as string | null,
    totalCents: r.total_cents,
    plannedCents: r.planned_cents,
  }));
}

export async function getByMember(scope: AnalyticsScope, range: DateRange) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("analytics_by_member", args(scope, range));
  if (error) throw error;
  return data.map((r) => ({
    memberId: r.member_id as string | null,
    incomeCents: r.income_cents,
    expenseCents: r.expense_cents,
  }));
}

export async function getBySource(scope: AnalyticsScope, range: DateRange) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("analytics_by_source", args(scope, range));
  if (error) throw error;
  return data.map((r) => ({
    type: r.source_type as "card" | "account" | "none",
    id: r.source_id as string | null,
    expenseCents: r.expense_cents,
    incomeCents: r.income_cents,
  }));
}

export async function getTopExpenses(scope: AnalyticsScope, range: DateRange, limit = 5) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("analytics_entries", args(scope, range))
    .eq("kind", "expense")
    .order("amount_cents", { ascending: false })
    .order("occurred_on", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((r) => ({
    id: r.transaction_id,
    description: r.description,
    amountCents: r.amount_cents,
    occurredOn: r.occurred_on,
    bucketDate: r.bucket_date,
    categoryId: r.category_id as string | null,
    isPlanned: r.is_planned,
    installment: r.installment_number ? `${r.installment_number}/${r.installment_total}` : null,
  }));
}

export type Position = {
  balanceCents: number;
  openInvoicesCents: number;
  invoicesDueCents: number;
  limitCents: number;
  availableLimitCents: number;
  plannedIncomeCents: number;
  plannedExpenseCents: number;
  /** Aportes previstos em metas que tiram dinheiro das contas consideradas (caixinha sem conta). */
  plannedSavingsCents: number;
  projectedBalanceCents: number;
  isProjection: boolean;
};

export async function getPosition(scope: AnalyticsScope, until: string): Promise<Position> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("analytics_position", {
      p_workspace_id: scope.workspaceId,
      p_until: until,
      p_account_id: scope.accountId,
      p_card_id: scope.cardId,
    })
    .single();
  if (error) throw error;
  return {
    balanceCents: data.balance_cents,
    openInvoicesCents: data.open_invoices_cents,
    invoicesDueCents: data.invoices_due_cents,
    limitCents: data.limit_cents,
    availableLimitCents: data.available_limit_cents,
    plannedIncomeCents: data.planned_income_cents,
    plannedExpenseCents: data.planned_expense_cents,
    plannedSavingsCents: data.planned_savings_cents,
    projectedBalanceCents: data.projected_balance_cents,
    isProjection: data.is_projection,
  };
}

export type UpcomingItem = {
  type: "bill" | "invoice";
  id: string;
  dueOn: string;
  description: string;
  amountCents: number;
  categoryId: string | null;
  cardId: string | null;
  isOverdue: boolean;
};

export async function getUpcoming(workspaceId: string, days = 15): Promise<UpcomingItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("analytics_upcoming", { p_workspace_id: workspaceId, p_days: days });
  if (error) throw error;
  return data.map((r) => ({
    type: r.item_type as "bill" | "invoice",
    id: r.ref_id,
    dueOn: r.due_on,
    description: r.description,
    amountCents: r.amount_cents,
    categoryId: r.category_id as string | null,
    cardId: r.card_id as string | null,
    isOverdue: r.is_overdue,
  }));
}

export type Savings = { savedCents: number; depositedCents: number; withdrawnCents: number; plannedCents: number };

/** Guardado em metas no período (aportes − retiradas), separado das despesas (ADR-0016). */
export async function getSavings(scope: AnalyticsScope, range: DateRange): Promise<Savings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("analytics_savings", {
      p_workspace_id: scope.workspaceId,
      p_from: range.from,
      p_to: range.to,
      p_member_id: scope.memberId,
      p_account_id: scope.accountId,
    })
    .single();
  if (error) throw error;
  return {
    savedCents: data.saved_cents,
    depositedCents: data.deposited_cents,
    withdrawnCents: data.withdrawn_cents,
    plannedCents: data.planned_cents,
  };
}
