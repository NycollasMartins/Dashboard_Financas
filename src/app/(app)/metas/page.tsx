import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Compass, Target } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { GoalCard } from "@/components/goals/goal-card";
import { GoalFormButton } from "@/components/goals/goal-form";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getLedgerLookups } from "@/lib/data/ledger";
import { listarMetas, type GoalView } from "@/lib/goals/service";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { getWorkspaceContext } from "@/lib/workspaces/context";

export const metadata: Metadata = { title: "Metas" };

const ORDERS = {
  prioridade: { label: "Prioridade", sort: (a: GoalView, b: GoalView) => a.priority - b.priority || (a.targetDate ?? "9").localeCompare(b.targetDate ?? "9") },
  prazo: { label: "Prazo", sort: (a: GoalView, b: GoalView) => (a.targetDate ?? "9").localeCompare(b.targetDate ?? "9") || a.priority - b.priority },
  progresso: { label: "Progresso", sort: (a: GoalView, b: GoalView) => b.progress.pct - a.progress.pct },
} as const;

export default function GoalsPage(props: PageProps<"/metas">) {
  return (
    <Suspense fallback={<GoalsSkeleton />}>
      <Goals searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Goals({ searchParams }: { searchParams: PageProps<"/metas">["searchParams"] }) {
  const [{ user, active }, sp] = await Promise.all([getWorkspaceContext(), searchParams]);
  const order = (typeof sp.ordem === "string" && sp.ordem in ORDERS ? sp.ordem : "prioridade") as keyof typeof ORDERS;
  const showArchived = sp.arquivadas === "1";
  const supabase = await createClient();
  const [res, lookups] = await Promise.all([
    listarMetas({ supabase, userId: user.id }, active.id, { includeArchived: showArchived }),
    getLedgerLookups(active.id, user.id),
  ]);
  if (!res.ok) throw new Error(res.message);
  const goals = res.data.filter((g) => (showArchived ? g.status === "archived" : g.status !== "archived"));
  const statusRank = { active: 0, paused: 1, achieved: 2, archived: 3 } as const;
  goals.sort((a, b) => statusRank[a.status] - statusRank[b.status] || ORDERS[order].sort(a, b));
  const activeGoals = res.data.filter((g) => g.status === "active");
  const saved = activeGoals.reduce((a, g) => a + g.savedCents, 0);
  const target = activeGoals.reduce((a, g) => a + g.targetCents, 0);
  const qs = (o: string, arch = showArchived) => `/metas?${new URLSearchParams({ ...(o !== "prioridade" ? { ordem: o } : {}), ...(arch ? { arquivadas: "1" } : {}) })}`;

  return (
    <>
      <PageHeader
        eyebrow={active.kind === "personal" ? "Espaço individual" : `Família · ${active.name}`}
        title="Metas"
        description={active.kind === "household" ? "Metas da família: todos veem e podem guardar; cada aporte mostra quem guardou." : "Suas metas pessoais: só você vê."}
        actions={<GoalFormButton workspaceId={active.id} accounts={lookups.accounts} defaultOpen={sp.nova === "1"} />}
      />
      {res.data.length === 0 ? (
        <EmptyState icon={Target} title="Qual é o seu próximo objetivo?" description="Crie uma meta (viagem, carro, reserva de emergência) e veja quanto guardar por mês e quando você chega lá." />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <section aria-label="Resumo das metas" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-[linear-gradient(140deg,color-mix(in_oklch,var(--savings)_14%,var(--card)),var(--card)_60%)] p-4 sm:p-5">
            <div>
              <p className="text-xs text-muted-foreground">Guardado nas metas ativas</p>
              <p className="font-heading text-2xl font-semibold"><Money cents={saved} /> <span className="text-sm font-normal text-muted-foreground">de <Money cents={target} /></span></p>
            </div>
            <Link href="/planejamento" className="flex h-11 items-center gap-2 rounded-xl border bg-card px-3 text-sm font-medium hover:bg-accent">
              <Compass className="size-4 text-primary" /> Ver planejamento
            </Link>
          </section>
          <nav aria-label="Ordenar metas" className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Ordenar por</span>
            {Object.entries(ORDERS).map(([k, o]) => (
              <Link key={k} href={qs(k)} aria-current={order === k ? "true" : undefined}
                className={cn("flex h-9 items-center rounded-full border px-3 text-xs font-medium hover:bg-accent", order === k && "border-primary text-primary")}>
                {o.label}
              </Link>
            ))}
            <Link href={qs(order, !showArchived)} className="ml-auto flex h-9 items-center px-2 text-xs font-medium text-muted-foreground hover:text-foreground">
              {showArchived ? "Ver metas ativas" : "Ver arquivadas"}
            </Link>
          </nav>
          {goals.length === 0 ? (
            <EmptyState icon={Target} title={showArchived ? "Nenhuma meta arquivada" : "Nenhuma meta ativa"} />
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 lg:gap-4">
              {goals.map((g, i) => (
                <div key={g.id} className="relative">
                  <GoalCard goal={g} index={i} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function GoalsSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-20 rounded-2xl" />
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
      </div>
    </div>
  );
}
