import type { Metadata } from "next";
import { Suspense } from "react";
import { Repeat } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { CategoryIcon } from "@/components/ledger/category-icon";
import { RecurrenceActions, RecurrenceFormButton, type RecurrenceRow } from "@/components/ledger/recurrence-form";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getLedgerLookups, listRecurrences } from "@/lib/data/ledger";
import { todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { getWorkspaceContext } from "@/lib/workspaces/context";

export const metadata: Metadata = { title: "Recorrências" };

const FREQ = { weekly: "Toda semana", monthly: "Todo mês", yearly: "Todo ano" } as const;

export default function RecurrencesPage() {
  return (
    <>
      <PageHeader
        title="Recorrências"
        description="Salários, aluguel, assinaturas… Os lançamentos do mês são gerados automaticamente (todo dia às 3h e na hora em que você cria)."
      />
      <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
        <RecurrencesContent />
      </Suspense>
    </>
  );
}

async function RecurrencesContent() {
  const { user, active } = await getWorkspaceContext();
  const [lookups, rows] = await Promise.all([getLedgerLookups(active.id, user.id), listRecurrences(active.id)]);
  const today = todayISO();
  const monthly = (r: (typeof rows)[number]) =>
    r.frequency === "monthly" ? r.amount_cents : r.frequency === "weekly" ? Math.round((r.amount_cents * 52) / 12) : Math.round(r.amount_cents / 12);
  const income = rows.filter((r) => r.is_active && r.kind === "income").reduce((a, r) => a + monthly(r), 0);
  const expense = rows.filter((r) => r.is_active && r.kind === "expense").reduce((a, r) => a + monthly(r), 0);

  if (rows.length === 0) {
    return (
      <EmptyState icon={Repeat} title="Nenhuma recorrência" description="Cadastre salários e contas fixas uma vez; o app lança todo mês para você.">
        <RecurrenceFormButton workspaceId={active.id} lookups={lookups} today={today} />
      </EmptyState>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Receitas fixas/mês</p>
          <Money cents={income} tone="income" className="font-heading text-xl font-semibold" />
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Despesas fixas/mês</p>
          <Money cents={expense} tone="expense" className="font-heading text-xl font-semibold" />
        </div>
        <div className="col-span-2 flex items-center justify-end sm:col-span-1">
          <RecurrenceFormButton workspaceId={active.id} lookups={lookups} today={today} />
        </div>
      </section>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {rows.map((r) => (
          <li key={r.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-3", !r.is_active && "opacity-60")}>
            <CategoryIcon icon={r.category?.icon} color={r.category?.color} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.description}</p>
              <p className="text-xs text-muted-foreground">
                {FREQ[r.frequency]}
                {r.frequency !== "weekly" && ` · dia ${r.day_of_month}`}
                {!r.is_active && " · pausada"}
              </p>
            </div>
            <Money cents={r.amount_cents} tone={r.kind === "income" ? "income" : "neutral"} className="text-sm font-semibold" />
            {/* No celular as ações vão para uma segunda linha, alinhadas à direita. */}
            <div className="flex w-full justify-end sm:w-auto">
              <RecurrenceFormButton workspaceId={active.id} lookups={lookups} today={today} recurrence={r as RecurrenceRow} />
              <RecurrenceActions id={r.id} active={r.is_active} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
