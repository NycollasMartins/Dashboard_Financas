import type { Metadata } from "next";
import { Suspense } from "react";
import { ListOrdered } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { LedgerFilters } from "@/components/ledger/ledger-filters";
import { LedgerList } from "@/components/ledger/ledger-list";
import { MonthNav } from "@/components/ledger/month-nav";
import { NewEntryButton } from "@/components/ledger/new-entry-button";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getLedgerLookups, listLedger, monthRange } from "@/lib/data/ledger";
import { todayISO } from "@/lib/dates";
import { transactionFiltersSchema } from "@/lib/validation/ledger";
import { getWorkspaceContext } from "@/lib/workspaces/context";

export const metadata: Metadata = { title: "Lançamentos" };

export default function LedgerPage({ searchParams }: PageProps<"/lancamentos">) {
  return (
    <>
      <PageHeader title="Lançamentos" actions={<NewEntryButton />} />
      <Suspense fallback={<LedgerSkeleton />}>
        <LedgerContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function LedgerContent({ searchParams }: { searchParams: PageProps<"/lancamentos">["searchParams"] }) {
  const raw = await searchParams;
  const filters = transactionFiltersSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  const { user, active } = await getWorkspaceContext();
  const [lookups, rows] = await Promise.all([getLedgerLookups(active.id, user.id), listLedger(active.id, filters)]);
  const { start } = monthRange(filters.mes);

  const income = rows.filter((r) => r.kind === "income").reduce((a, r) => a + r.amountCents, 0);
  const expense = rows.filter((r) => r.kind === "expense").reduce((a, r) => a + r.amountCents, 0);
  const hasFilters = Boolean(filters.tipo || filters.categoria || filters.membro || filters.conta || filters.cartao || filters.q);

  return (
    // minmax(0,1fr): impede a coluna de crescer até a largura mínima do conteúdo
    // (sem isso, textos longos estouravam a tela no iPhone).
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthNav month={start} params={{ ...filters, mes: undefined }} basePath="/lancamentos" />
        <dl className="grid w-full grid-cols-3 gap-2 text-sm sm:flex sm:w-auto sm:gap-5">
          <div>
            <dt className="text-xs text-muted-foreground">Receitas</dt>
            <dd className="truncate"><Money cents={income} tone="income" className="font-semibold" /></dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Despesas</dt>
            <dd className="truncate"><Money cents={expense} tone="expense" className="font-semibold" /></dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Saldo</dt>
            <dd className="truncate"><Money cents={income - expense} className="font-semibold" /></dd>
          </div>
        </dl>
      </div>
      <LedgerFilters lookups={lookups} />
      {rows.length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title={hasFilters ? "Nada encontrado com esses filtros" : "Nenhum lançamento neste mês"}
          description={hasFilters ? "Tente limpar os filtros ou mudar de mês." : "Toque no + para registrar uma receita, despesa ou transferência."}
        >
          {!hasFilters && <NewEntryButton />}
        </EmptyState>
      ) : (
        <LedgerList rows={rows} lookups={lookups} today={todayISO()} />
      )}
    </div>
  );
}

function LedgerSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true">
      <Skeleton className="h-11 w-64" />
      <Skeleton className="h-11" />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-40 rounded-2xl" />
      ))}
    </div>
  );
}
