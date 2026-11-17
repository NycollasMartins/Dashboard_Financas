import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft, Info } from "lucide-react";
import { GoalStatusButtons, QuickSaveButton, WithdrawButton } from "@/components/goals/goal-actions";
import { GoalChart } from "@/components/goals/goal-chart";
import { GoalFormButton } from "@/components/goals/goal-form";
import { GoalHistory, PlanCard } from "@/components/goals/history";
import { GoalSimulator } from "@/components/goals/simulator";
import { GoalIcon, GoalRing, PaceBadge, shortMonth } from "@/components/goals/goal-visuals";
import { Money } from "@/components/money";
import { Skeleton } from "@/components/ui/skeleton";
import { buildCategoryTree } from "@/lib/analytics/categories";
import { getLedgerLookups } from "@/lib/data/ledger";
import { addDays } from "@/lib/analytics/period";
import { addMonths, monthStart, todayISO } from "@/lib/dates";
import { consultarProgressoMeta } from "@/lib/goals/service";
import { createClient } from "@/lib/supabase/server";
import { GOAL_STATUS_LABEL, PRIORITY_LABEL } from "@/lib/validation/goals";
import { getWorkspaceContext } from "@/lib/workspaces/context";

export const metadata: Metadata = { title: "Meta" };

export default function GoalPage(props: PageProps<"/metas/[id]">) {
  return (
    <Suspense fallback={<div className="grid gap-4" aria-busy="true"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div>}>
      <GoalContent params={props.params} />
    </Suspense>
  );
}

async function GoalContent({ params }: { params: PageProps<"/metas/[id]">["params"] }) {
  const [{ id }, { user, active }] = await Promise.all([params, getWorkspaceContext()]);
  const supabase = await createClient();
  const today = todayISO();
  const m0 = monthStart(today);
  const [res, lookups, cats] = await Promise.all([
    consultarProgressoMeta({ supabase, userId: user.id, today }, id),
    getLedgerLookups(active.id, user.id),
    // Só gastos VARIÁVEIS (sem recorrências e parcelas): cortar aluguel não é um cenário realista.
    supabase.rpc("analytics_entries", {
      p_workspace_id: active.id, p_from: addMonths(m0, -3), p_to: addDays(m0, -1), p_basis: "accrual", p_include_projected: false,
    }),
  ]);
  if (!res.ok) notFound();
  const { goal: g, contributions, members, series } = res.data;
  if (g.workspaceId !== active.id) notFound(); // meta de outro espaço: troque de espaço para vê-la

  const meta = new Map(lookups.categories.map((c) => [c.id, { id: c.id, name: c.name, color: c.color, icon: c.icon }]));
  // Média mensal por categoria nos 3 meses fechados (para "cortar X% em Y").
  const variable = (cats.data ?? [])
    .filter((e) => e.kind === "expense" && !e.is_fixed)
    .map((e) => ({ categoryId: e.category_id, parentId: e.root_category_id !== e.category_id ? e.root_category_id : null, totalCents: e.amount_cents, plannedCents: 0 }));
  const catAvg = buildCategoryTree(variable, [], [], meta)
    .filter((n) => n.id && n.totalCents > 0)
    .slice(0, 8)
    .map((n) => ({ id: n.id!, name: n.name, avgMonthlyCents: Math.round(n.totalCents / 3) }));
  const accounts = new Map(lookups.accounts.map((a) => [a.id, a.name]));
  const people = new Map(lookups.members.map((m) => [m.id, m.name]));
  const isAdmin = active.role === "admin";
  const canChange = g.status !== "archived";
  const reqText =
    g.required.kind === "monthly" ? (
      <>Guarde <Money cents={g.required.monthlyCents} className="font-semibold" /> por mês até {shortMonth(g.targetDate)} ({g.required.months} meses).</>
    ) : g.required.kind === "this_month" ? (
      <>O prazo é este mês: faltam <Money cents={g.required.monthlyCents} className="font-semibold" />.</>
    ) : g.required.kind === "overdue" ? (
      <>O prazo ({shortMonth(g.targetDate)}) já passou: faltam <Money cents={g.required.monthlyCents} className="font-semibold" />. Ajuste o prazo ou o valor.</>
    ) : g.required.kind === "done" ? (
      <>Meta atingida{g.progress.exceededCents > 0 && <> com <Money cents={g.progress.exceededCents} /> a mais</>}. 🎉</>
    ) : (
      <>Sem prazo definido.</>
    );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-5">
      <Link href="/metas" className="flex h-11 w-fit items-center gap-1 rounded-xl pr-3 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Metas
      </Link>

      <section aria-labelledby="goal-title" className="relative grid gap-5 overflow-hidden rounded-2xl border bg-card p-5 animate-rise sm:p-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full opacity-60 blur-3xl" style={{ background: `color-mix(in oklch, ${g.color} 25%, transparent)` }} />
        <GoalRing pct={g.progress.pct} color={g.color} size={132} stroke={12} label={`${Math.round(g.progress.pct * 100)}% concluído`}>
          <span className="grid justify-items-center">
            <GoalIcon icon={g.icon} color={g.color} className="size-6" />
            <span className="font-heading text-2xl font-semibold">{Math.round(g.progress.pct * 100)}%</span>
          </span>
        </GoalRing>
        <div className="relative grid min-w-0 gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
              {GOAL_STATUS_LABEL[g.status]} · prioridade {PRIORITY_LABEL[g.priority].toLowerCase()}
            </p>
            <h1 id="goal-title" className="text-2xl font-semibold sm:text-3xl">{g.name}</h1>
            <p className="mt-1 text-sm">
              <Money cents={g.savedCents} className="font-heading text-xl font-semibold" /> <span className="text-muted-foreground">de</span>{" "}
              <Money cents={g.targetCents} className="text-muted-foreground" />
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-xl bg-surface-2/50 px-3 py-2">
              <dt className="text-muted-foreground">Falta</dt>
              <dd className="text-sm font-semibold"><Money cents={g.progress.remainingCents} /></dd>
            </div>
            <div className="rounded-xl bg-surface-2/50 px-3 py-2">
              <dt className="text-muted-foreground">Por mês p/ o prazo</dt>
              <dd className="text-sm font-semibold">{g.required.monthlyCents != null && g.required.kind !== "done" ? <Money cents={g.required.monthlyCents} /> : "—"}</dd>
            </div>
            <div className="rounded-xl bg-surface-2/50 px-3 py-2">
              <dt className="text-muted-foreground">{g.estimate.basis === "plan" ? "Ritmo (plano)" : "Ritmo (média ponderada)"}</dt>
              <dd className="text-sm font-semibold">{g.estimate.monthlyCents ? <><Money cents={g.estimate.monthlyCents} />/mês</> : "—"}</dd>
            </div>
            <div className="rounded-xl bg-surface-2/50 px-3 py-2">
              <dt className="text-muted-foreground">Chega em</dt>
              <dd className="text-sm font-semibold">{g.progress.done ? "Concluída" : g.estimate.date ? shortMonth(g.estimate.date) : "—"}</dd>
            </div>
          </dl>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <PaceBadge status={g.status === "achieved" ? "done" : g.estimate.status} deltaMonths={g.estimate.deltaMonths} />
            <span>{reqText}</span>
          </p>
          {g.annualReturnBps > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="size-3.5" /> Projeção com rendimento estimado de {(g.annualReturnBps / 100).toLocaleString("pt-BR")}% a.a. — é uma estimativa.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {canChange && g.status !== "achieved" && <QuickSaveButton goalId={g.id} name={g.name} size="lg" />}
            {canChange && g.savedCents > 0 && <WithdrawButton goalId={g.id} />}
            <GoalFormButton workspaceId={active.id} accounts={lookups.accounts} goal={{
              id: g.id, name: g.name, icon: g.icon, color: g.color, targetCents: g.targetCents, targetDate: g.targetDate,
              priority: g.priority, initialCents: g.initialCents, reserveAccountId: g.reserveAccountId, annualReturnBps: g.annualReturnBps, notes: g.notes,
            }} />
          </div>
        </div>
      </section>

      <GoalChart realized={series.realized} projected={series.projected} ideal={series.ideal} targetCents={g.targetCents} color={g.color} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:items-start lg:gap-5">
        <GoalSimulator
          goal={{ savedCents: g.savedCents, targetCents: g.targetCents, targetDate: g.targetDate, annualReturnBps: g.annualReturnBps }}
          paceCents={g.estimate.monthlyCents && g.estimate.monthlyCents > 0 ? g.estimate.monthlyCents : null}
          today={today}
          categories={catAvg}
        />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-5">
          {canChange && g.status !== "achieved" && (
            <PlanCard workspaceId={active.id} goalId={g.id} accounts={lookups.accounts} today={today} defaultAccountId={lookups.defaults.accountId}
              plan={g.plan ? { amountCents: g.plan.amountCents, frequency: g.plan.frequency, day: g.plan.day, accountId: g.plan.accountId, autoConfirm: g.plan.autoConfirm } : null} />
          )}
          {active.kind === "household" && members.length > 0 && (
            <section aria-labelledby="members-title" className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-2xl border bg-card p-4 animate-rise sm:p-5">
              <h2 id="members-title" className="text-base font-semibold">Quem guardou</h2>
              <ul className="grid gap-3">
                {members.map((m) => {
                  const total = members.reduce((a, x) => a + Math.max(0, x.cents), 0) || 1;
                  return (
                    <li key={m.memberId ?? "x"} className="grid gap-1">
                      <span className="flex justify-between text-sm"><span className="font-medium">{(m.memberId && people.get(m.memberId)) || "Ex-membro"}</span><Money cents={m.cents} className="font-semibold" /></span>
                      <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <span className="block h-full rounded-full" style={{ width: `${(Math.max(0, m.cents) / total) * 100}%`, background: g.color }} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <GoalHistory
            items={contributions.map((c) => ({
              id: c.id,
              amountCents: c.amountCents,
              contributedOn: c.contributedOn,
              account: c.accountId ? accounts.get(c.accountId) ?? null : null,
              member: c.memberId ? people.get(c.memberId)?.split(" ")[0] ?? null : null,
              note: c.note,
              isPlanned: c.isPlanned,
              fromPlan: c.fromPlan,
              canEdit: isAdmin || c.createdBy === user.id,
            }))}
          />
          <section aria-label="Gerenciar meta" className="grid gap-3 rounded-2xl border bg-card p-4 sm:p-5">
            <GoalStatusButtons goalId={g.id} status={g.status} canDelete={isAdmin || active.kind === "personal"} />
          </section>
        </div>
      </div>
    </div>
  );
}
