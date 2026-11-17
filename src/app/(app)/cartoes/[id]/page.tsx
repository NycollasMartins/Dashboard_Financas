import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Receipt } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { CategoryIcon } from "@/components/ledger/category-icon";
import { InvoiceStatusBadge } from "@/components/ledger/invoice-status";
import { NewEntryButton } from "@/components/ledger/new-entry-button";
import { DeletePaymentButton, PayInvoiceButton } from "@/components/ledger/pay-invoice";
import { Money } from "@/components/money";
import { Skeleton } from "@/components/ui/skeleton";
import { getLedgerLookups, listCardInvoices, listInvoiceItems } from "@/lib/data/ledger";
import { formatMonth, formatMonthShort, todayISO, type ISODate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { uuidSchema } from "@/lib/validation/workspace";
import { getWorkspaceContext } from "@/lib/workspaces/context";

export const metadata: Metadata = { title: "Fatura" };

const dFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
const d = (iso: string) => {
  const [y, m, day] = iso.split("-").map(Number);
  return dFmt.format(new Date(Date.UTC(y, m - 1, day))).replace(".", "");
};

export default function CardPage(props: PageProps<"/cartoes/[id]">) {
  return (
    <>
      <Link href="/cartoes" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Cartões
      </Link>
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <CardContent {...props} />
      </Suspense>
    </>
  );
}

async function CardContent({ params, searchParams }: PageProps<"/cartoes/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!uuidSchema.safeParse(id).success) notFound();
  const { user, active } = await getWorkspaceContext();
  const [lookups, invoices] = await Promise.all([getLedgerLookups(active.id, user.id), listCardInvoices(active.id, id)]);
  const card = lookups.cards.find((c) => c.id === id);
  if (!card) notFound();
  const today = todayISO();

  const wanted = typeof sp.fatura === "string" ? sp.fatura : undefined;
  const current =
    invoices.find((i) => i.referenceMonth.startsWith(wanted ?? "_")) ??
    invoices.find((i) => i.status === "overdue") ??
    invoices.find((i) => i.status !== "paid" && i.dueDate >= today) ??
    invoices.at(-1);
  const detail = current ? await listInvoiceItems(current.id) : null;
  const accounts = new Map(lookups.accounts.map((a) => [a.id, a.name]));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            Fecha dia {card.closingDay} · vence dia {card.dueDay}
          </p>
          <h1 className="text-2xl font-semibold sm:text-3xl">{card.name}</h1>
        </div>
        <NewEntryButton label="Nova compra" draft={{ kind: "expense", paymentMethod: "credit", cardId: card.id }} />
      </header>

      {invoices.length === 0 || !current || !detail ? (
        <EmptyState icon={Receipt} title="Nenhuma fatura ainda" description="Lance uma compra no crédito deste cartão e a fatura aparece aqui." />
      ) : (
        <>
          {/* Seletor de fatura (rolagem horizontal) */}
          <nav aria-label="Faturas" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {invoices.map((i) => (
              <Link
                key={i.id}
                href={`/cartoes/${card.id}?fatura=${i.referenceMonth.slice(0, 7)}`}
                aria-current={i.id === current.id ? "page" : undefined}
                className={cn(
                  "flex min-h-11 shrink-0 flex-col justify-center rounded-xl border px-3 py-1.5 text-xs",
                  i.id === current.id ? "border-primary bg-primary/10" : "text-muted-foreground hover:bg-accent",
                )}
              >
                <span className="font-semibold">{formatMonthShort(i.referenceMonth as ISODate)}</span>
                <Money cents={i.totalCents} className="text-[11px]" />
              </Link>
            ))}
          </nav>

          <section className="rounded-2xl border bg-card p-5 animate-rise">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Fatura de {formatMonth(current.referenceMonth as ISODate)}</p>
                <Money cents={current.totalCents} className="block font-heading text-3xl font-semibold" />
                <p className="mt-1 text-xs text-muted-foreground">
                  Fecha {d(current.closingDate)} · vence {d(current.dueDate)} · {current.items} {current.items === 1 ? "item" : "itens"}
                </p>
              </div>
              <InvoiceStatusBadge status={current.status} />
            </div>
            {current.paidCents > 0 && (
              <p className="mt-3 text-sm">
                Pago <Money cents={current.paidCents} tone="income" className="font-semibold" />
                {current.remainingCents > 0 && (
                  <> · falta <Money cents={current.remainingCents} className="font-semibold" /></>
                )}
              </p>
            )}
            <div className="mt-4">
              <PayInvoiceButton
                workspaceId={active.id}
                invoiceId={current.id}
                remainingCents={current.remainingCents}
                accounts={lookups.accounts}
                today={today}
              />
            </div>
          </section>

          <section aria-label="Itens da fatura">
            <h2 className="mb-2 px-1 text-sm font-semibold">Itens</h2>
            {detail.items.length === 0 ? (
              <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Sem compras nesta fatura.</p>
            ) : (
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                {detail.items.map((t) => (
                  <li key={t.id} className="flex min-h-14 items-center gap-3 px-3 py-2">
                    <CategoryIcon icon={t.category?.icon} color={t.category?.color} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {t.description}
                        {t.installment_total ? ` (${t.installment_number}/${t.installment_total})` : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">{d(t.occurred_on)} · {t.category?.name ?? "Sem categoria"}</span>
                    </span>
                    <Money cents={t.amount_cents} className="text-sm font-semibold" />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {detail.payments.length > 0 && (
            <section aria-label="Pagamentos">
              <h2 className="mb-2 px-1 text-sm font-semibold">Pagamentos</h2>
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                {detail.payments.map((p) => (
                  <li key={p.id} className="flex min-h-14 items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 text-sm">
                      {d(p.paid_on)} · {p.account_id ? accounts.get(p.account_id) ?? "Conta" : "Sem conta"}
                    </span>
                    <Money cents={p.amount_cents} tone="income" className="text-sm font-semibold" />
                    <DeletePaymentButton id={p.id} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
