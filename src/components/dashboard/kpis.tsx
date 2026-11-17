import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CreditCard, Landmark, Receipt } from "lucide-react";
import { Money } from "@/components/money";
import { formatPct, toneFor, variation, type MetricKind } from "@/lib/analytics/delta";
import { cn } from "@/lib/utils";

/*
 * Primeira dobra SEM animação de opacidade: elementos invisíveis não contam
 * como pintados e atrasavam o LCP (Lighthouse) — desempenho no celular.
 *
 * KPIs do topo. A variação mostra seta + % + texto (nunca só cor): gasto
 * subindo = ruim (coral), receita/saldo/taxa subindo = bom (verde).
 */

export function DeltaBadge({
  metric,
  current,
  previous,
  previousLabel,
  isRate,
}: {
  metric: MetricKind;
  current: number;
  previous: number;
  previousLabel: string;
  isRate?: boolean;
}) {
  const v = variation(current, previous);
  const tone = toneFor(metric, v.direction);
  const Icon = v.direction === "up" ? ArrowUpRight : v.direction === "down" ? ArrowDownRight : ArrowRight;
  // Taxa: diferença em pontos percentuais (12% → 18% = +6 p.p.)
  const text = isRate
    ? `${v.diff >= 0 ? "+" : "−"}${Math.round(Math.abs(v.diff) * 100)} p.p.`
    : formatPct(v.pct);
  const toneWord = tone === "good" ? "melhor" : tone === "bad" ? "pior" : "estável";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
        tone === "good" && "bg-income-muted text-income",
        tone === "bad" && "bg-expense-muted text-expense",
        tone === "neutral" && "bg-muted text-muted-foreground",
      )}
      title={`Comparado a ${previousLabel}`}
    >
      <Icon aria-hidden className="size-3.5" />
      <span>{text}</span>
      <span className="sr-only"> em relação a {previousLabel} ({toneWord})</span>
    </span>
  );
}

export function KpiCard({
  label,
  icon: Icon,
  iconClass,
  cents,
  rate,
  metric,
  previous,
  previousLabel,
  planned,
  plannedLabel,
  highlight,
  note,
  className,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  cents?: number;
  rate?: number | null;
  metric: MetricKind;
  previous: number | null;
  previousLabel: string;
  planned?: number;
  plannedLabel?: string;
  highlight?: boolean;
  note?: React.ReactNode;
  className?: string;
}) {
  const current = rate !== undefined ? (rate ?? 0) : (cents ?? 0);
  return (
    <article
      className={cn(
        "grid min-w-0 content-between gap-2 rounded-2xl border bg-card p-4 sm:p-5",
        highlight && "bg-[linear-gradient(140deg,color-mix(in_oklch,var(--primary)_12%,var(--card)),var(--card)_60%)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <h3 className="truncate text-xs font-medium sm:text-sm">{label}</h3>
        <Icon className={cn("size-4 shrink-0", iconClass)} />
      </div>
      <p className="font-heading text-xl font-semibold sm:text-2xl xl:text-[1.45rem] 2xl:text-[1.6rem]">
        {rate !== undefined ? (
          rate === null ? <span className="text-muted-foreground">—</span> : `${Math.round(rate * 100)}%`
        ) : (
          <Money cents={cents ?? 0} />
        )}
      </p>
      <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1">
        {previous !== null && (rate === undefined || rate !== null) && (
          <DeltaBadge metric={metric} current={current} previous={previous} previousLabel={previousLabel} isRate={rate !== undefined} />
        )}
        {planned ? (
          <span className="text-[11px] text-muted-foreground">
            + <Money cents={planned} /> {plannedLabel ?? "previsto"}
          </span>
        ) : null}
      </div>
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
    </article>
  );
}

/** Cartão-herói: saldo projetado para o fim do período (ou saldo final, se passado). */
export function ProjectionCard({
  isProjection,
  balanceCents,
  projectedCents,
  plannedIncomeCents,
  plannedExpenseCents,
  invoicesDueCents,
  plannedSavingsCents = 0,
  untilLabel,
}: {
  isProjection: boolean;
  balanceCents: number;
  projectedCents: number;
  plannedIncomeCents: number;
  plannedExpenseCents: number;
  invoicesDueCents: number;
  plannedSavingsCents?: number;
  untilLabel: string;
}) {
  const negative = projectedCents < 0;
  return (
    <section
      aria-labelledby="projecao-title"
      className="relative grid gap-4 overflow-hidden rounded-2xl border bg-card p-5 sm:p-6"
    >
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-[radial-gradient(closest-side,var(--glow-1),transparent)] animate-glow" />
      <div className="relative grid gap-1">
        <h2 id="projecao-title" className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
          {isProjection ? `Saldo projetado · ${untilLabel}` : `Saldo no fim do período · ${untilLabel}`}
        </h2>
        <p className={cn("font-heading text-3xl font-semibold sm:text-4xl", negative && "text-expense")}>
          <Money cents={projectedCents} />
        </p>
        <p className="text-xs text-muted-foreground">
          {isProjection
            ? "Saldo das contas hoje, mais o que ainda vai entrar, menos o que ainda vai sair."
            : "Soma das contas no último dia do período (só o que foi realizado)."}
        </p>
      </div>
      {isProjection && (
        <dl className="relative grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
          <ProjectionTerm label="Saldo hoje" cents={balanceCents} />
          <ProjectionTerm label="Receitas previstas" cents={plannedIncomeCents} sign="+" tone="text-income" />
          <ProjectionTerm label="Despesas previstas" cents={plannedExpenseCents} sign="−" tone="text-expense" />
          <ProjectionTerm label="Faturas a vencer" cents={invoicesDueCents} sign="−" tone="text-expense" />
          {plannedSavingsCents !== 0 && (
            <ProjectionTerm label="Aportes previstos (caixinhas)" cents={plannedSavingsCents} sign="−" tone="text-savings" />
          )}
        </dl>
      )}
    </section>
  );
}

function ProjectionTerm({ label, cents, sign, tone }: { label: string; cents: number; sign?: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-2/50 px-3 py-2">
      <dt className="truncate text-[11px] text-muted-foreground">{label}</dt>
      <dd className={cn("truncate font-semibold", tone)}>
        {sign && <span aria-hidden>{sign} </span>}
        <Money cents={cents} />
      </dd>
    </div>
  );
}

/** Posição: saldo das contas, faturas em aberto, limite disponível. */
export function PositionStrip({
  balanceCents,
  openInvoicesCents,
  availableLimitCents,
  limitCents,
}: {
  balanceCents: number;
  openInvoicesCents: number;
  availableLimitCents: number;
  limitCents: number;
}) {
  const items = [
    { label: "Saldo atual das contas", cents: balanceCents, icon: Landmark, href: "/contas" },
    { label: "Faturas em aberto", cents: openInvoicesCents, icon: Receipt, href: "/cartoes" },
    {
      label: limitCents > 0 ? "Limite disponível" : "Limite disponível (sem limite cadastrado)",
      cents: availableLimitCents,
      icon: CreditCard,
      href: "/cartoes",
    },
  ];
  return (
    <ul className="grid gap-2 sm:grid-cols-3 sm:gap-3" aria-label="Posição atual">
      {items.map((it) => (
        <li key={it.label}>
          <Link href={it.href} className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-4 py-3 hover:bg-accent/50">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted-foreground">
              <it.icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs text-muted-foreground">{it.label}</span>
              <Money cents={it.cents} className="block font-semibold" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
