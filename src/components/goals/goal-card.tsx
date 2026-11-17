import Link from "next/link";
import { Money } from "@/components/money";
import type { GoalView } from "@/lib/goals/service";
import { cn } from "@/lib/utils";
import { GOAL_STATUS_LABEL, PRIORITY_LABEL } from "@/lib/validation/goals";
import { QuickSaveButton } from "./goal-actions";
import { GoalIcon, GoalRing, PaceBadge, shortMonth } from "./goal-visuals";

/** Cartão da meta: anel, guardado/alvo, falta, mensal necessário, estimativa e ritmo. */
export function GoalCard({ goal, index = 0 }: { goal: GoalView; index?: number }) {
  const g = goal;
  const inactive = g.status === "paused" || g.status === "archived";
  return (
    <article
      style={{ animationDelay: `${index * 40}ms` }}
      className={cn("grid gap-4 rounded-2xl border bg-card p-4 animate-rise sm:p-5", inactive && "opacity-75")}
      aria-labelledby={`goal-${g.id}`}
    >
      <div className="flex items-start gap-4">
        <GoalRing pct={g.progress.pct} color={g.color} size={68} label={`${g.name}: ${Math.round(g.progress.pct * 100)}% concluído`}>
          <span className="grid justify-items-center">
            <GoalIcon icon={g.icon} color={g.color} className="size-4" />
            <span className="text-xs font-semibold">{Math.round(g.progress.pct * 100)}%</span>
          </span>
        </GoalRing>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`goal-${g.id}`} className="truncate text-base font-semibold">
              <Link href={`/metas/${g.id}`} className="after:absolute after:inset-0 hover:underline">{g.name}</Link>
            </h2>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">
              {g.status === "active" ? `Prioridade ${PRIORITY_LABEL[g.priority].toLowerCase()}` : GOAL_STATUS_LABEL[g.status]}
            </span>
          </div>
          <p className="mt-1 text-sm">
            <Money cents={g.savedCents} className="font-semibold" /> <span className="text-muted-foreground">de</span>{" "}
            <Money cents={g.targetCents} className="text-muted-foreground" />
          </p>
          <div className="mt-1.5">
            <PaceBadge status={g.status === "achieved" ? "done" : g.estimate.status} deltaMonths={g.estimate.deltaMonths} />
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-xl bg-surface-2/50 px-3 py-2">
          <dt className="text-muted-foreground">Falta</dt>
          <dd className="truncate text-sm font-semibold"><Money cents={g.progress.remainingCents} /></dd>
        </div>
        <div className="rounded-xl bg-surface-2/50 px-3 py-2">
          <dt className="text-muted-foreground">{g.targetDate ? `Por mês até ${shortMonth(g.targetDate)}` : "Prazo"}</dt>
          <dd className="truncate text-sm font-semibold">
            {g.required.kind === "monthly" || g.required.kind === "this_month" || g.required.kind === "overdue" ? (
              <>
                <Money cents={g.required.monthlyCents} />
                {g.required.kind !== "monthly" && <span className="ml-1 text-[10px] font-medium text-warning">{g.required.kind === "overdue" ? "vencido" : "este mês"}</span>}
              </>
            ) : g.required.kind === "done" ? "—" : "Sem prazo"}
          </dd>
        </div>
        <div className="col-span-2 rounded-xl bg-surface-2/50 px-3 py-2 sm:col-span-1">
          <dt className="text-muted-foreground">
            {g.estimate.basis === "plan" ? "Chega (pelo plano)" : g.estimate.basis === "history" ? "Chega (pelo ritmo)" : "Estimativa"}
          </dt>
          <dd className="truncate text-sm font-semibold">
            {g.progress.done ? "Concluída" : g.estimate.date ? shortMonth(g.estimate.date) : "Sem aportes ainda"}
          </dd>
        </div>
      </dl>
      {g.status !== "archived" && g.status !== "achieved" && (
        <div className="relative z-10 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {g.plan ? <>Plano: <Money cents={g.plan.monthlyCents} />/mês</> : g.paceCents && g.paceCents > 0 ? <>Ritmo: <Money cents={g.paceCents} />/mês</> : "Sem ritmo ainda"}
          </span>
          <QuickSaveButton goalId={g.id} name={g.name} />
        </div>
      )}
    </article>
  );
}
