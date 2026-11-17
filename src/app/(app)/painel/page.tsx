import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Circle, PiggyBank, Scale, Sparkles } from "lucide-react";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { addMonths, formatMonth, monthStart, todayISO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { getWorkspaceContext } from "@/lib/workspaces/context";

export const metadata: Metadata = { title: "Painel" };

async function getMonthTotals(workspaceId: string) {
  const start = monthStart(todayISO());
  const end = addMonths(start, 1);
  const supabase = await createClient();
  const [tx, contributions] = await Promise.all([
    supabase
      .from("transactions")
      .select("kind, amount_cents")
      .eq("workspace_id", workspaceId)
      .gte("occurred_on", start)
      .lt("occurred_on", end),
    supabase
      .from("goal_contributions")
      .select("amount_cents")
      .eq("workspace_id", workspaceId)
      .gte("contributed_on", start)
      .lt("contributed_on", end),
  ]);
  if (tx.error) throw tx.error;
  if (contributions.error) throw contributions.error;

  let income = 0;
  let expense = 0;
  for (const t of tx.data) {
    if (t.kind === "income") income += t.amount_cents;
    else expense += t.amount_cents;
  }
  const saved = contributions.data.reduce((acc, c) => acc + c.amount_cents, 0);
  return { month: start, income, expense, balance: income - expense, saved };
}

export default async function DashboardPage() {
  const { user, active, workspaces } = await getWorkspaceContext();
  const totals = await getMonthTotals(active.id);
  const firstName = user.fullName.split(" ")[0] || "por aqui";
  const hasHousehold = workspaces.some((w) => w.kind === "household");

  const kpis = [
    { label: "Receitas", cents: totals.income, tone: "income" as const, icon: ArrowUpRight },
    { label: "Despesas", cents: totals.expense, tone: "expense" as const, icon: ArrowDownRight },
    { label: "Saldo do mês", cents: totals.balance, tone: "neutral" as const, icon: Scale },
    { label: "Guardado", cents: totals.saved, tone: "savings" as const, icon: PiggyBank },
  ];

  const steps = [
    { done: true, label: "Criar sua conta", href: null },
    { done: hasHousehold, label: "Criar o espaço da família", href: "/familia" },
    { done: false, label: "Cadastrar cartões e despesas fixas", href: null, phase: 2 },
    { done: false, label: "Definir sua primeira meta", href: null, phase: 4 },
    { done: false, label: "Conectar o WhatsApp", href: null, phase: 6 },
  ];

  return (
    <>
      <PageHeader
        eyebrow={formatMonth(totals.month)}
        title={`Olá, ${firstName}`}
        description={
          active.kind === "personal"
            ? "Você está no seu espaço individual."
            : `Você está no espaço da família “${active.name}”.`
        }
      />

      <section aria-label="Resumo do mês" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {kpis.map((k, i) => (
          <article
            key={k.label}
            style={{ animationDelay: `${i * 50}ms` }}
            className={cn(
              "group relative overflow-hidden rounded-2xl border bg-card p-4 animate-rise sm:p-5",
              i === 2 && "bg-[linear-gradient(140deg,color-mix(in_oklch,var(--primary)_14%,var(--card)),var(--card)_60%)]",
            )}
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium sm:text-sm">{k.label}</span>
              <k.icon
                className={cn(
                  "size-4",
                  k.tone === "income" && "text-income",
                  k.tone === "expense" && "text-expense",
                  k.tone === "savings" && "text-savings",
                  k.tone === "neutral" && "text-primary",
                )}
              />
            </div>
            <Money
              cents={k.cents}
              className="mt-3 block font-heading text-xl font-semibold sm:text-2xl lg:text-[1.65rem]"
            />
          </article>
        ))}
      </section>

      <div className="mt-6 grid gap-4 lg:mt-8 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border bg-card p-5 animate-rise [animation-delay:200ms]">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="text-base font-semibold">Primeiros passos</h2>
          </div>
          <ol className="mt-4 grid gap-1">
            {steps.map((s) => {
              const content = (
                <>
                  {s.done ? (
                    <CheckCircle2 className="size-5 shrink-0 text-income" />
                  ) : (
                    <Circle className="size-5 shrink-0 text-muted-foreground/50" />
                  )}
                  <span className={cn("flex-1 text-sm", s.done && "text-muted-foreground line-through")}>
                    {s.label}
                  </span>
                  {s.phase && (
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      Fase {s.phase}
                    </span>
                  )}
                </>
              );
              return (
                <li key={s.label}>
                  {s.href && !s.done ? (
                    <Link href={s.href} className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-accent">
                      {content}
                    </Link>
                  ) : (
                    <div className="flex min-h-11 items-center gap-3 px-2">{content}</div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        <section className="grid content-start gap-3 rounded-2xl border bg-card p-5 animate-rise [animation-delay:250ms]">
          <h2 className="text-base font-semibold">Em construção</h2>
          <p className="text-sm text-muted-foreground">
            Gráficos por categoria, evolução mensal, faturas abertas e progresso das metas chegam na Fase 3.
          </p>
          <div aria-hidden className="mt-2 flex h-28 items-end gap-2">
            {[40, 65, 50, 80, 55, 90, 70].map((h, i) => (
              <div
                key={i}
                style={{ height: `${h}%` }}
                className="flex-1 rounded-t-md bg-[linear-gradient(to_top,color-mix(in_oklch,var(--primary)_10%,transparent),color-mix(in_oklch,var(--primary)_45%,transparent))]"
              />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
