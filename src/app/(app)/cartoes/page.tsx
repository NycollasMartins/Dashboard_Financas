import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, CreditCard } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { CardFormButton } from "@/components/ledger/card-form";
import { InvoiceStatusBadge } from "@/components/ledger/invoice-status";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getLedgerLookups, listCardInvoices } from "@/lib/data/ledger";
import { formatMonthTitle, todayISO, type ISODate } from "@/lib/dates";
import { getWorkspaceContext } from "@/lib/workspaces/context";

export const metadata: Metadata = { title: "Cartões" };

export default function CardsPage() {
  return (
    <>
      <PageHeader title="Cartões" description="Faturas são montadas automaticamente pela data de fechamento de cada cartão." />
      <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
        <CardsContent />
      </Suspense>
    </>
  );
}

async function CardsContent() {
  const { user, active } = await getWorkspaceContext();
  const [lookups, invoices] = await Promise.all([getLedgerLookups(active.id, user.id), listCardInvoices(active.id)]);
  const today = todayISO();

  if (lookups.cards.length === 0) {
    return (
      <EmptyState
        icon={CreditCard}
        title="Nenhum cartão ainda"
        description="Cadastre seus cartões com dia de fechamento e vencimento. As compras no crédito caem sozinhas na fatura certa."
      >
        <CardFormButton workspaceId={active.id} />
      </EmptyState>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex justify-end">
        <CardFormButton workspaceId={active.id} />
      </div>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
        {lookups.cards.map((c) => {
          const cardInvoices = invoices.filter((i) => i.cardId === c.id);
          // Fatura "atual" = a primeira ainda não paga cujo vencimento não passou há mais de 1 mês.
          const current =
            cardInvoices.find((i) => i.status === "overdue") ??
            cardInvoices.find((i) => i.status !== "paid" && i.dueDate >= today) ??
            cardInvoices.at(-1);
          const usedPct = c.limitCents ? Math.min(100, Math.round((c.usedCents / c.limitCents) * 100)) : null;
          return (
            <li key={c.id} className="relative overflow-hidden rounded-2xl border bg-card animate-rise">
              <div aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: c.color ?? "#8b5cf6" }} />
              <div className="flex items-start justify-between gap-2 p-5 pb-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold">{c.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {[c.brand, c.last4 && `•••• ${c.last4}`, `fecha dia ${c.closingDay}`, `vence dia ${c.dueDay}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <CardFormButton workspaceId={active.id} card={c} />
              </div>
              {c.limitCents ? (
                <div className="px-5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Disponível <Money cents={c.availableCents ?? 0} className="font-semibold text-foreground" /></span>
                    <span>de <Money cents={c.limitCents} /></span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={usedPct ?? 0} aria-label="Limite usado">
                    <div className="h-full rounded-full" style={{ width: `${usedPct}%`, backgroundColor: c.color ?? "var(--primary)" }} />
                  </div>
                </div>
              ) : null}
              {current ? (
                <Link href={`/cartoes/${c.id}?fatura=${current.referenceMonth.slice(0, 7)}`} className="mt-4 flex items-center gap-3 border-t px-5 py-4 hover:bg-accent/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Fatura de {formatMonthTitle(current.referenceMonth as ISODate).toLowerCase()}</p>
                    <Money cents={current.totalCents} className="font-heading text-xl font-semibold" />
                  </div>
                  <InvoiceStatusBadge status={current.status} />
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              ) : (
                <Link href={`/cartoes/${c.id}`} className="mt-4 flex items-center justify-between border-t px-5 py-4 text-sm text-muted-foreground hover:bg-accent/50">
                  Nenhuma compra ainda <ChevronRight className="size-4" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
