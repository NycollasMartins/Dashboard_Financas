import type { Metadata } from "next";
import { Suspense } from "react";
import { ArrowLeftRight, Wallet } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { AccountFormButton } from "@/components/ledger/account-form";
import { NewEntryButton } from "@/components/ledger/new-entry-button";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getLedgerLookups } from "@/lib/data/ledger";
import { ACCOUNT_TYPE_LABELS } from "@/lib/validation/ledger";
import { getWorkspaceContext } from "@/lib/workspaces/context";

export const metadata: Metadata = { title: "Contas" };

export default function AccountsPage() {
  return (
    <>
      <PageHeader title="Contas" description="Saldos calculados a partir dos lançamentos confirmados — nunca digitados à mão." />
      <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
        <AccountsContent />
      </Suspense>
    </>
  );
}

async function AccountsContent() {
  const { user, active } = await getWorkspaceContext();
  const { accounts } = await getLedgerLookups(active.id, user.id);
  const total = accounts.reduce((a, c) => a + c.balanceCents, 0);

  if (accounts.length === 0) {
    return (
      <EmptyState icon={Wallet} title="Nenhuma conta ainda" description="Cadastre conta corrente, poupança ou dinheiro em espécie para acompanhar os saldos.">
        <AccountFormButton workspaceId={active.id} />
      </EmptyState>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <section className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border bg-[linear-gradient(140deg,color-mix(in_oklch,var(--primary)_14%,var(--card)),var(--card)_60%)] p-5">
        <div>
          <p className="text-sm text-muted-foreground">Saldo total</p>
          <Money cents={total} className="font-heading text-3xl font-semibold" />
        </div>
        <div className="flex flex-wrap gap-2">
          {accounts.length > 1 && <NewEntryButton label="Transferir" draft={{ kind: "transfer", type: "transfer" }} />}
          <AccountFormButton workspaceId={active.id} />
        </div>
      </section>
      <ul className="grid gap-3 sm:grid-cols-2">
        {accounts.map((a) => (
          <li key={a.id} className="flex items-center gap-3 rounded-2xl border bg-card p-4 animate-rise">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `color-mix(in oklch, ${a.color ?? "#5eead4"} 18%, transparent)`, color: a.color ?? undefined }}>
              {a.type === "wallet" ? <Wallet className="size-5" /> : <ArrowLeftRight className="size-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{a.name}</p>
              <p className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[a.type as keyof typeof ACCOUNT_TYPE_LABELS]}</p>
              {a.pendingCents !== 0 && (
                <p className="text-xs text-warning">
                  Previsto: <Money cents={a.pendingCents} signed />
                </p>
              )}
            </div>
            <Money cents={a.balanceCents} className="font-semibold" tone={a.balanceCents < 0 ? "expense" : "neutral"} />
            <AccountFormButton workspaceId={active.id} account={a} />
          </li>
        ))}
      </ul>
    </div>
  );
}
