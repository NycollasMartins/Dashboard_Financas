"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, CalendarClock, Check, CreditCard, Repeat } from "lucide-react";
import { confirmEntryAction } from "@/app/(app)/_actions/ledger";
import type { LedgerLookups, LedgerRow } from "@/lib/data/ledger";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PAYMENT_LABELS } from "@/lib/validation/ledger";
import { CategoryIcon } from "./category-icon";
import { useEntrySheet } from "./entry-sheet";

const dayFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });
function dayLabel(iso: string, today: string) {
  if (iso === today) return "Hoje";
  const [y, m, d] = iso.split("-").map(Number);
  const s = dayFmt.format(new Date(Date.UTC(y, m - 1, d))).replace(/\./g, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function LedgerList({ rows, lookups, today }: { rows: LedgerRow[]; lookups: LedgerLookups; today: string }) {
  const { open } = useEntrySheet();
  const accounts = new Map(lookups.accounts.map((a) => [a.id, a.name]));
  const cards = new Map(lookups.cards.map((c) => [c.id, c.name]));
  const members = new Map(lookups.members.map((m) => [m.id, m.name.split(" ")[0]]));

  const groups = new Map<string, LedgerRow[]>();
  for (const r of rows) groups.set(r.occurredOn, [...(groups.get(r.occurredOn) ?? []), r]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {[...groups.entries()].map(([day, items]) => {
        const total = items.reduce((acc, r) => acc + (r.kind === "income" ? r.amountCents : r.kind === "expense" ? -r.amountCents : 0), 0);
        return (
          <section key={day} aria-label={dayLabel(day, today)} className="animate-rise">
            <header className="mb-2 flex items-baseline justify-between px-1">
              <h2 className="text-sm font-semibold">{dayLabel(day, today)}</h2>
              <span className={cn("text-money text-xs", total > 0 ? "text-income" : total < 0 ? "text-expense" : "text-muted-foreground")}>
                {formatBRL(total, { signed: true })}
              </span>
            </header>
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
              {items.map((r) => {
                const who = members.get(r.memberUserId ?? r.createdBy ?? "");
                const meta = [
                  r.kind === "transfer"
                    ? `${accounts.get(r.accountId ?? "") ?? "?"} → ${accounts.get(r.toAccountId ?? "") ?? "?"}`
                    : r.category?.name ?? "Sem categoria",
                  r.cardId ? cards.get(r.cardId) : r.paymentMethod && r.kind !== "transfer" ? PAYMENT_LABELS[r.paymentMethod as keyof typeof PAYMENT_LABELS] : null,
                  r.installmentTotal ? `${r.installmentNumber}/${r.installmentTotal}` : null,
                  lookups.members.length > 1 ? who : null,
                ].filter(Boolean);
                return (
                  <li key={`${r.type}-${r.id}`} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        open({
                          id: r.id,
                          type: r.type,
                          kind: r.kind,
                          amountCents: r.amountCents,
                          description: r.description,
                          occurredOn: r.occurredOn,
                          categoryId: r.category?.id ?? null,
                          paymentMethod: r.paymentMethod,
                          accountId: r.accountId,
                          toAccountId: r.toAccountId,
                          cardId: r.cardId,
                          memberUserId: r.memberUserId,
                          notes: r.notes,
                          isSettled: r.isSettled,
                          installmentNumber: r.installmentNumber,
                          installmentTotal: r.installmentTotal,
                        })
                      }
                      className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/60"
                    >
                      {r.kind === "transfer" ? (
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-info/15 text-info">
                          <ArrowLeftRight className="size-5" />
                        </span>
                      ) : (
                        <CategoryIcon icon={r.category?.icon} color={r.category?.color} />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">{r.description}</span>
                          {r.recurrenceId && <Repeat className="size-3.5 shrink-0 text-muted-foreground" aria-label="Recorrente" />}
                          {r.cardId && <CreditCard className="size-3.5 shrink-0 text-muted-foreground" aria-label="Cartão" />}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{meta.join(" · ")}</span>
                      </span>
                      <span className="grid justify-items-end gap-0.5">
                        <span
                          className={cn(
                            "text-money text-sm font-semibold",
                            r.kind === "income" && "text-income",
                            r.kind === "expense" && "text-foreground",
                            r.kind === "transfer" && "text-muted-foreground",
                            !r.isSettled && "opacity-60",
                          )}
                        >
                          {r.kind === "income" ? "+" : r.kind === "expense" ? "−" : ""}
                          {formatBRL(r.amountCents)}
                        </span>
                        {!r.isSettled && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold tracking-wide text-warning uppercase">
                            <CalendarClock className="size-3" /> Previsto
                          </span>
                        )}
                      </span>
                    </button>
                    {!r.isSettled && <ConfirmButton id={r.id} />}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ConfirmButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await confirmEntryAction(id);
          if (res.status === "error") toast.error(res.message);
          else toast.success("Marcado como pago/recebido.");
        })
      }
      aria-label="Confirmar pagamento"
      className="mr-2 grid size-11 shrink-0 place-items-center rounded-xl border border-dashed text-muted-foreground hover:border-income hover:text-income"
    >
      <Check className="size-4" />
    </button>
  );
}
