import "server-only";
import { cache } from "react";
import { addMonths, todayISO, type ISODate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { TransactionFilters } from "@/lib/validation/ledger";

/*
 * Consultas da Fase 2. Todas usam o cliente com a sessão do usuário → a RLS
 * garante que só voltam dados dos espaços dele. Sempre filtramos pelo espaço
 * ATIVO também, para não misturar individual e família.
 */

export type CategoryOption = {
  id: string;
  kind: "income" | "expense";
  name: string;
  icon: string;
  color: string;
  parentId: string | null;
  archived: boolean;
  usage: number;
};
export type AccountOption = {
  id: string;
  name: string;
  type: string;
  color: string | null;
  balanceCents: number;
  pendingCents: number;
  initialBalanceCents: number;
};
export type CardOption = {
  id: string;
  name: string;
  brand: string | null;
  last4: string | null;
  color: string | null;
  closingDay: number;
  dueDay: number;
  limitCents: number | null;
  usedCents: number;
  availableCents: number | null;
};
export type MemberOption = { id: string; name: string; email: string; role: "admin" | "member"; isOwner: boolean };

export type LedgerLookups = {
  categories: CategoryOption[];
  accounts: AccountOption[];
  cards: CardOption[];
  members: MemberOption[];
  defaults: { paymentMethod: string; accountId: string | null; cardId: string | null };
};

export const getLedgerLookups = cache(async (workspaceId: string, userId: string): Promise<LedgerLookups> => {
  const supabase = await createClient();
  const since = addMonths(`${todayISO().slice(0, 7)}-01` as ISODate, -3);

  const [cats, usage, accounts, cards, members, last] = await Promise.all([
    supabase
      .from("categories")
      .select("id, kind, name, icon, color, parent_id, archived_at, sort_order")
      .eq("workspace_id", workspaceId)
      .order("sort_order")
      .order("name"),
    supabase
      .from("transactions")
      .select("category_id")
      .eq("workspace_id", workspaceId)
      .gte("occurred_on", since)
      .not("category_id", "is", null)
      .limit(2000),
    supabase
      .from("account_balances")
      .select("account_id, name, type, color, balance_cents, pending_cents, initial_balance_cents, archived_at")
      .eq("workspace_id", workspaceId)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("credit_card_summaries")
      .select("card_id, name, brand, last4, color, closing_day, due_day, limit_cents, used_cents, available_cents, archived_at")
      .eq("workspace_id", workspaceId)
      .is("archived_at", null)
      .order("name"),
    supabase.rpc("get_workspace_members", { p_workspace_id: workspaceId }),
    supabase
      .from("transactions")
      .select("payment_method, account_id, card_id")
      .eq("workspace_id", workspaceId)
      .eq("created_by", userId)
      .eq("source", "manual")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  for (const r of [cats, usage, accounts, cards, members, last]) if (r.error) throw r.error;

  const counts = new Map<string, number>();
  for (const u of usage.data ?? []) counts.set(u.category_id!, (counts.get(u.category_id!) ?? 0) + 1);

  const lastTx = last.data?.[0];
  return {
    categories: (cats.data ?? []).map((c) => ({
      id: c.id,
      kind: c.kind,
      name: c.name,
      icon: c.icon,
      color: c.color,
      parentId: c.parent_id,
      archived: Boolean(c.archived_at),
      usage: counts.get(c.id) ?? 0,
    })),
    accounts: (accounts.data ?? []).map((a) => ({
      id: a.account_id!,
      name: a.name!,
      type: a.type!,
      color: a.color,
      balanceCents: a.balance_cents ?? 0,
      pendingCents: a.pending_cents ?? 0,
      initialBalanceCents: a.initial_balance_cents ?? 0,
    })),
    cards: (cards.data ?? []).map((c) => ({
      id: c.card_id!,
      name: c.name!,
      brand: c.brand,
      last4: c.last4,
      color: c.color,
      closingDay: c.closing_day!,
      dueDay: c.due_day!,
      limitCents: c.limit_cents,
      usedCents: c.used_cents ?? 0,
      availableCents: c.available_cents,
    })),
    members: (members.data ?? []).map((m) => ({
      id: m.user_id,
      name: m.full_name || m.email,
      email: m.email,
      role: m.role,
      isOwner: m.is_owner,
    })),
    defaults: {
      paymentMethod: lastTx?.payment_method ?? "pix",
      accountId: lastTx?.account_id ?? null,
      cardId: lastTx?.card_id ?? null,
    },
  };
});

export type LedgerRow = {
  type: "transaction" | "transfer";
  id: string;
  kind: "income" | "expense" | "transfer";
  amountCents: number;
  description: string;
  occurredOn: string;
  createdAt: string;
  category: { id: string; name: string; icon: string; color: string } | null;
  paymentMethod: string | null;
  accountId: string | null;
  toAccountId: string | null;
  cardId: string | null;
  invoiceMonth: string | null;
  installmentNumber: number | null;
  installmentTotal: number | null;
  memberUserId: string | null;
  createdBy: string | null;
  isSettled: boolean;
  recurrenceId: string | null;
  notes: string | null;
};

export function monthRange(month?: string) {
  const start = (month ? `${month}-01` : `${todayISO().slice(0, 7)}-01`) as ISODate;
  return { start, end: addMonths(start, 1) };
}

export async function listLedger(workspaceId: string, filters: TransactionFilters): Promise<LedgerRow[]> {
  const supabase = await createClient();
  const { start, end } = monthRange(filters.mes);

  const wantsTransfers = !filters.tipo || filters.tipo === "transfer";
  const wantsTx = filters.tipo !== "transfer";
  const onlyTxFilters = filters.categoria || filters.cartao || filters.membro;

  const childIds = filters.categoria
    ? ((await supabase.from("categories").select("id").eq("workspace_id", workspaceId).eq("parent_id", filters.categoria)).data ?? []).map((c) => c.id)
    : [];

  const txQuery = () => {
    let q = supabase
      .from("transactions")
      .select(
        "id, kind, amount_cents, description, occurred_on, created_at, payment_method, account_id, card_id, installment_number, installment_total, member_user_id, created_by, is_settled, recurrence_id, notes, category:categories(id, name, icon, color), invoice:card_invoices(reference_month)",
      )
      .eq("workspace_id", workspaceId)
      .gte("occurred_on", start)
      .lt("occurred_on", end)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000);
    if (filters.tipo === "income" || filters.tipo === "expense") q = q.eq("kind", filters.tipo);
    // Categoria-pai inclui as subcategorias (o painel leva para cá).
    if (filters.categoria) q = q.in("category_id", [filters.categoria, ...childIds]);
    if (filters.cartao) q = q.eq("card_id", filters.cartao);
    if (filters.conta) q = q.eq("account_id", filters.conta);
    if (filters.membro) q = q.or(`member_user_id.eq.${filters.membro},and(member_user_id.is.null,created_by.eq.${filters.membro})`);
    if (filters.q) q = q.ilike("description", `%${filters.q.replace(/[%_]/g, "")}%`);
    return q;
  };

  const trQuery = () => {
    let q = supabase
      .from("transfers")
      .select("id, amount_cents, description, occurred_on, created_at, from_account_id, to_account_id, created_by")
      .eq("workspace_id", workspaceId)
      .gte("occurred_on", start)
      .lt("occurred_on", end)
      .order("occurred_on", { ascending: false })
      .limit(500);
    if (filters.conta) q = q.or(`from_account_id.eq.${filters.conta},to_account_id.eq.${filters.conta}`);
    if (filters.q) q = q.ilike("description", `%${filters.q.replace(/[%_]/g, "")}%`);
    return q;
  };

  const [tx, tr] = await Promise.all([
    wantsTx ? txQuery() : Promise.resolve({ data: [], error: null }),
    wantsTransfers && !onlyTxFilters ? trQuery() : Promise.resolve({ data: [], error: null }),
  ]);
  if (tx.error) throw tx.error;
  if (tr.error) throw tr.error;

  const rows: LedgerRow[] = [
    ...(tx.data ?? []).map((t) => ({
      type: "transaction" as const,
      id: t.id,
      kind: t.kind,
      amountCents: t.amount_cents,
      description: t.description,
      occurredOn: t.occurred_on,
      createdAt: t.created_at,
      category: t.category,
      paymentMethod: t.payment_method,
      accountId: t.account_id,
      toAccountId: null,
      cardId: t.card_id,
      invoiceMonth: t.invoice?.reference_month ?? null,
      installmentNumber: t.installment_number,
      installmentTotal: t.installment_total,
      memberUserId: t.member_user_id,
      createdBy: t.created_by,
      isSettled: t.is_settled,
      recurrenceId: t.recurrence_id,
      notes: t.notes,
    })),
    ...(tr.data ?? []).map((t) => ({
      type: "transfer" as const,
      id: t.id,
      kind: "transfer" as const,
      amountCents: t.amount_cents,
      description: t.description || "Transferência",
      occurredOn: t.occurred_on,
      createdAt: t.created_at,
      category: null,
      paymentMethod: null,
      accountId: t.from_account_id,
      toAccountId: t.to_account_id,
      cardId: null,
      invoiceMonth: null,
      installmentNumber: null,
      installmentTotal: null,
      memberUserId: null,
      createdBy: t.created_by,
      isSettled: true,
      recurrenceId: null,
      notes: null,
    })),
  ];
  return rows.sort((a, b) =>
    a.occurredOn === b.occurredOn ? b.createdAt.localeCompare(a.createdAt) : b.occurredOn.localeCompare(a.occurredOn),
  );
}

export type InvoiceSummary = {
  id: string;
  cardId: string;
  referenceMonth: string;
  closingDate: string;
  dueDate: string;
  totalCents: number;
  paidCents: number;
  remainingCents: number;
  items: number;
  status: "open" | "closed" | "paid" | "overdue";
};

export async function listCardInvoices(workspaceId: string, cardId?: string): Promise<InvoiceSummary[]> {
  const supabase = await createClient();
  let q = supabase
    .from("card_invoice_summaries")
    .select("invoice_id, card_id, reference_month, closing_date, due_date, total_cents, paid_cents, remaining_cents, items, status")
    .eq("workspace_id", workspaceId)
    .order("reference_month");
  if (cardId) q = q.eq("card_id", cardId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((i) => ({
    id: i.invoice_id!,
    cardId: i.card_id!,
    referenceMonth: i.reference_month!,
    closingDate: i.closing_date!,
    dueDate: i.due_date!,
    totalCents: i.total_cents ?? 0,
    paidCents: i.paid_cents ?? 0,
    remainingCents: i.remaining_cents ?? 0,
    items: i.items ?? 0,
    status: (i.status ?? "open") as InvoiceSummary["status"],
  }));
}

export async function listInvoiceItems(invoiceId: string) {
  const supabase = await createClient();
  const [items, payments] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, description, amount_cents, occurred_on, installment_number, installment_total, created_by, category:categories(name, icon, color)")
      .eq("invoice_id", invoiceId)
      .order("occurred_on")
      .order("created_at"),
    supabase
      .from("invoice_payments")
      .select("id, amount_cents, paid_on, account_id, created_by")
      .eq("invoice_id", invoiceId)
      .order("paid_on"),
  ]);
  if (items.error) throw items.error;
  if (payments.error) throw payments.error;
  return { items: items.data ?? [], payments: payments.data ?? [] };
}

export async function listRecurrences(workspaceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurrences")
    .select(
      "id, kind, description, amount_cents, payment_method, account_id, card_id, member_user_id, frequency, day_of_month, starts_on, ends_on, is_active, auto_confirm, created_by, category_id, category:categories(name, icon, color)",
    )
    .eq("workspace_id", workspaceId)
    .order("is_active", { ascending: false })
    .order("kind")
    .order("day_of_month");
  if (error) throw error;
  return data ?? [];
}
