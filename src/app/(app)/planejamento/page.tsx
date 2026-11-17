import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, CheckCircle2, Compass, Info, Target } from "lucide-react";
import { SectionEmpty } from "@/components/dashboard/categories";
import { GoalIcon, PaceBadge } from "@/components/goals/goal-visuals";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { consultarPlanejamento } from "@/lib/goals/service";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { getWorkspaceContext } from "@/lib/workspaces/context";

export const metadata: Metadata = { title: "Planejamento" };

export default function PlanningPage() {
  return (
    <>
      <PageHeader title="Planejamento" description="Quanto sobra por mês de verdade, quanto já está comprometido com metas e como dividir o resto." />
      <Suspense fallback={<div className="grid gap-4" aria-busy="true"><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>}>
        <Planning />
      </Suspense>
    </>
  );
}

async function Planning() {
  const { user, active } = await getWorkspaceContext();
  const res = await consultarPlanejamento({ supabase: await createClient(), userId: user.id }, active.id);
  if (!res.ok) throw new Error(res.message);
  const { capacity: c, distribution: d, goals } = res.data;
  const active_ = goals.filter((g) => g.status === "active" && !g.progress.done);
  const negative = c.surplusCents < 0;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-5">
      <section aria-labelledby="sobra-title" className="grid gap-4 rounded-2xl border bg-card p-5 animate-rise sm:p-6">
        <div>
          <h2 id="sobra-title" className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">Sobra mensal realista</h2>
          <p className={cn("font-heading text-3xl font-semibold sm:text-4xl", negative && "text-expense")}><Money cents={c.surplusCents} /></p>
          <p className="text-xs text-muted-foreground">
            {c.months > 0 ? `Com base nos últimos ${c.months} ${c.months === 1 ? "mês" : "meses"} e nas contas fixas do próximo mês.` : "Ainda sem histórico: lance alguns meses para uma estimativa realista."}
          </p>
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-4">
          <Term label="Renda" sub={<>fixa <Money cents={c.fixedIncomeCents} /> + eventual (média) <Money cents={c.variableIncomeCents} /></>} cents={c.incomeCents} tone="text-income" />
          <Term label="− Despesas fixas" sub="recorrências e parcelas do próximo mês" cents={c.fixedExpenseCents} tone="text-expense" />
          <Term label="− Despesas variáveis" sub="média mensal" cents={c.variableExpenseCents} tone="text-expense" />
          <Term label="= Sobra" sub={<>guardado em média: <Money cents={c.avgSavedCents} />/mês</>} cents={c.surplusCents} />
        </dl>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-surface-2/50 px-4 py-3">
            <p className="text-xs text-muted-foreground">Já comprometido com metas (aportes planejados)</p>
            <p className="text-lg font-semibold"><Money cents={c.committedCents} /><span className="text-xs font-normal text-muted-foreground">/mês</span></p>
          </div>
          <div className="rounded-xl bg-surface-2/50 px-4 py-3">
            <p className="text-xs text-muted-foreground">Sobra livre (depois dos planos)</p>
            <p className={cn("text-lg font-semibold", c.freeCents < 0 && "text-expense")}><Money cents={c.freeCents} /><span className="text-xs font-normal text-muted-foreground">/mês</span></p>
          </div>
        </div>
      </section>

      {negative ? (
        <Alert tone="bad" title="Suas despesas estão maiores que a renda">
          Em média sai <Money cents={-c.surplusCents} /> a mais do que entra por mês. Antes de novas metas, vale rever as despesas variáveis.
        </Alert>
      ) : active_.length > 0 && !d.feasible ? (
        <Alert tone="bad" title="As metas somadas não cabem na sua sobra">
          Para cumprir todas no prazo você precisaria guardar <Money cents={d.requiredTotalCents} className="font-semibold" />/mês;
          sua sobra média é <Money cents={c.surplusCents} className="font-semibold" />. Faltam <Money cents={d.shortfallCents} />/mês —
          estique um prazo, reduza um valor ou corte gastos (use o simulador da meta).
        </Alert>
      ) : active_.length > 0 ? (
        <Alert tone="good" title="Dá para cumprir os prazos">
          As metas com prazo pedem <Money cents={d.requiredTotalCents} />/mês e sua sobra é <Money cents={c.surplusCents} />.
        </Alert>
      ) : null}

      <section aria-labelledby="dist-title" className="grid gap-3 rounded-2xl border bg-card p-4 animate-rise sm:p-5">
        <div>
          <h2 id="dist-title" className="flex items-center gap-2 text-base font-semibold"><Compass className="size-4 text-primary" /> Sugestão de distribuição da sobra</h2>
          <p className="text-xs text-muted-foreground">
            Primeiro as metas com prazo recebem o valor mensal necessário (prioridade alta antes; no empate, o prazo mais próximo).
            O que sobra vai para as metas sem prazo, proporcional à prioridade (alta 3 · média 2 · baixa 1).
          </p>
        </div>
        {active_.length === 0 ? (
          <SectionEmpty icon={Target} text="Nenhuma meta ativa para distribuir.">
            <Link href="/metas?nova=1" className="text-sm font-medium text-primary">Criar uma meta</Link>
          </SectionEmpty>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[22rem] text-left text-sm [&_td]:py-2.5 [&_td]:pr-3 [&_th]:pb-2 [&_th]:pr-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground [&_tbody_tr]:border-t">
              <caption className="sr-only">Sugestão de quanto guardar por mês em cada meta</caption>
              <thead><tr><th>Meta</th><th className="text-right">Precisa/mês</th><th className="text-right">Sugestão/mês</th><th>Situação</th></tr></thead>
              <tbody>
                {d.allocations.map((a) => {
                  const g = goals.find((x) => x.id === a.id)!;
                  return (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/metas/${a.id}`} className="flex min-h-11 items-center gap-2 font-medium hover:underline">
                          <GoalIcon icon={g.icon} color={g.color} className="size-4 shrink-0" /> <span className="truncate">{a.name}</span>
                        </Link>
                      </td>
                      <td className="text-right text-money">{a.requiredCents === null ? <span className="text-muted-foreground">sem prazo</span> : <Money cents={a.requiredCents} />}</td>
                      <td className="text-right text-money font-semibold"><Money cents={a.cents} /></td>
                      <td>
                        {a.requiredCents !== null && !a.covered ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-warning"><AlertTriangle className="size-3.5" /> não cabe</span>
                        ) : (
                          <PaceBadge status={g.estimate.status} deltaMonths={g.estimate.deltaMonths} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {d.unallocatedCents > 0 && active_.length > 0 && (
          <p className="text-xs text-muted-foreground">Sobram <Money cents={d.unallocatedCents} />/mês sem destino — que tal uma nova meta?</p>
        )}
      </section>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Renda = receitas fixas previstas para o próximo mês + média das receitas eventuais (freelas, 13º). Despesas fixas = recorrências e
        parcelas do próximo mês (motor de projeção). Variáveis = média dos meses fechados. Guardar dinheiro não é despesa: aportes não
        entram nessas contas. Detalhes em docs/requisitos.md (RN-81 e RN-82).
      </p>
    </div>
  );
}

function Term({ label, sub, cents, tone }: { label: string; sub: React.ReactNode; cents: number; tone?: string }) {
  return (
    <div className="rounded-xl bg-surface-2/50 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("font-semibold", tone)}><Money cents={cents} /></dd>
      <dd className="text-[11px] text-muted-foreground">{sub}</dd>
    </div>
  );
}

function Alert({ tone, title, children }: { tone: "good" | "bad"; title: string; children: React.ReactNode }) {
  const Icon = tone === "good" ? CheckCircle2 : AlertTriangle;
  return (
    <div role="note" className={cn("flex gap-3 rounded-2xl border p-4", tone === "bad" ? "border-warning/40 bg-warning/10" : "border-income/30 bg-income-muted")}>
      <Icon className={cn("mt-0.5 size-5 shrink-0", tone === "bad" ? "text-warning" : "text-income")} aria-hidden />
      <div className="grid gap-1 text-sm">
        <p className="font-semibold">{title}</p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
