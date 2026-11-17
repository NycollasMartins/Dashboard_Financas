import Link from "next/link";
import { ChevronRight, Target } from "lucide-react";
import { SectionEmpty } from "@/components/dashboard/categories";
import { Money } from "@/components/money";
import type { GoalView } from "@/lib/goals/service";
import { GoalIcon, GoalRing, PaceBadge, shortMonth } from "./goal-visuals";

/** Widget de metas no painel: as 3 mais prioritárias, com ritmo e estimativa. */
export function GoalsWidget({ goals }: { goals: GoalView[] }) {
  const list = [...goals].sort((a, b) => Number(a.progress.done) - Number(b.progress.done) || a.priority - b.priority).slice(0, 3);
  return (
    <section aria-labelledby="metas-widget-title" className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-2xl border bg-card p-4 animate-rise sm:p-5">
      <header className="flex items-center justify-between gap-2">
        <h2 id="metas-widget-title" className="flex items-center gap-2 text-base font-semibold"><Target className="size-4 text-savings" /> Metas</h2>
        <Link href="/metas" className="flex h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-primary hover:bg-accent">
          Ver todas <ChevronRight className="size-4" />
        </Link>
      </header>
      {list.length === 0 ? (
        <SectionEmpty icon={Target} text="Crie uma meta e acompanhe aqui quanto falta e quando você chega lá.">
          <Link href="/metas?nova=1" className="text-sm font-medium text-primary">Criar meta</Link>
        </SectionEmpty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-3">
          {list.map((g) => (
            <li key={g.id}>
              <Link href={`/metas/${g.id}`} className="flex items-center gap-3 rounded-xl border px-3 py-3 hover:bg-accent/50">
                <GoalRing pct={g.progress.pct} color={g.color} size={52} stroke={6}>
                  <GoalIcon icon={g.icon} color={g.color} className="size-4" />
                </GoalRing>
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate text-sm font-medium">{g.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    <Money cents={g.savedCents} /> de <Money cents={g.targetCents} />
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <PaceBadge status={g.progress.done ? "done" : g.estimate.status} deltaMonths={g.estimate.deltaMonths} />
                    {!g.progress.done && g.estimate.date && <span className="text-[11px] text-muted-foreground">{shortMonth(g.estimate.date)}</span>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
