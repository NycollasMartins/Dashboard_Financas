import Link from "next/link";
import { PieChart } from "lucide-react";
import { CategoryIcon } from "@/components/ledger/category-icon";
import { Money } from "@/components/money";
import { topWithOthers, type CategoryNode } from "@/lib/analytics/categories";
import { formatPct, toneFor, variation } from "@/lib/analytics/delta";
import { cn } from "@/lib/utils";
import { ChartFrame, LegendItem, tableClass } from "./chart-frame";

const pct = (share: number) => `${Math.round(share * 100)}%`;
const VISIBLE = 6;

/**
 * Gastos por categoria: barra segmentada (parte-do-todo, até 5 + "Outras") e
 * lista ranqueada com barra única. Cada linha leva à lista de lançamentos
 * filtrada por aquela categoria (inclui as subcategorias).
 */
export function CategoryBreakdown({
  nodes,
  totalCents,
  hrefFor,
  title = "Gastos por categoria",
}: {
  nodes: CategoryNode[];
  totalCents: number;
  hrefFor: (categoryId: string) => string;
  title?: string;
}) {
  if (nodes.length === 0) {
    return (
      <section aria-labelledby="categorias-title" className="grid content-start gap-3 rounded-2xl border bg-card p-5 animate-rise">
        <h2 id="categorias-title" className="text-base font-semibold">{title}</h2>
        <SectionEmpty icon={PieChart} text="Nenhuma despesa neste período." />
      </section>
    );
  }
  const { top, others } = topWithOthers(nodes, 5);
  const maxCents = nodes[0].totalCents;
  const renderRow = (n: CategoryNode, i: number) => {
          const v = variation(n.totalCents, n.previousCents);
          const tone = toneFor("expense", v.direction);
          const row = (
            <>
              <CategoryIcon icon={n.icon} color={n.color} size="sm" />
              <span className="grid min-w-0 flex-1 gap-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">{n.name}</span>
                  <Money cents={n.totalCents} className="shrink-0 text-sm font-semibold" />
                </span>
                <span aria-hidden className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full origin-left rounded-full bg-viz-expense animate-grow-x"
                    style={{ width: `${(n.totalCents / maxCents) * 100}%`, animationDelay: `${i * 40}ms` }} />
                </span>
                <span className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="truncate">
                    {pct(n.share)} do total
                    {n.children.length > 0 && ` · ${n.children.slice(0, 2).map((c) => c.name).join(", ")}${n.children.length > 2 ? "…" : ""}`}
                  </span>
                  {n.previousCents > 0 && (
                    <span className={cn("shrink-0 font-medium", tone === "good" && "text-income", tone === "bad" && "text-expense")}>
                      {formatPct(v.pct)} <span className="sr-only">em relação ao período anterior</span>
                      <span aria-hidden className="font-normal text-muted-foreground"> vs. anterior</span>
                    </span>
                  )}
                </span>
              </span>
            </>
          );
          return (
            <li key={n.id ?? "none"}>
              {n.id ? (
                <Link href={hrefFor(n.id)} className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 hover:bg-accent/60"
                  aria-label={`${n.name}: ver lançamentos`}>
                  {row}
                </Link>
              ) : (
                <div className="flex min-h-14 items-center gap-3 px-2 py-2">{row}</div>
              )}
            </li>
          );
  };

  const chart = (
    <div className="grid gap-4">
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img"
        aria-label={`Distribuição: ${top.map((n) => `${n.name} ${pct(n.share)}`).join(", ")}${others ? `, outras ${pct(others.share)}` : ""}.`}>
        {top.map((n, i) => (
          <div key={n.id ?? "none"} title={`${n.name}: ${pct(n.share)}`} className="h-full origin-left animate-grow-x first:rounded-l-full last:rounded-r-full"
            style={{ flexGrow: n.totalCents, flexBasis: 0, minWidth: 3, background: n.color, animationDelay: `${i * 40}ms` }} />
        ))}
        {others && (
          <div title={`Outras: ${pct(others.share)}`} className="h-full rounded-r-full bg-muted-foreground/40"
            style={{ flexGrow: others.totalCents, flexBasis: 0, minWidth: 3 }} />
        )}
      </div>
      <ol className="grid gap-1">{nodes.slice(0, VISIBLE).map(renderRow)}</ol>
      {nodes.length > VISIBLE && (
        <details className="group">
          <summary className="flex h-11 cursor-pointer list-none items-center justify-center rounded-xl text-sm font-medium text-primary hover:bg-accent [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Mostrar mais {nodes.length - VISIBLE} categorias</span>
            <span className="hidden group-open:inline">Mostrar menos</span>
          </summary>
          <ol className="grid gap-1" start={VISIBLE + 1}>{nodes.slice(VISIBLE).map((n, i) => renderRow(n, i + VISIBLE))}</ol>
        </details>
      )}
    </div>
  );

  const table = (
    <table className={tableClass}>
      <caption className="sr-only">{title}</caption>
      <thead><tr><th>Categoria</th><th className="num">Valor</th><th className="num">%</th><th className="num">Anterior</th></tr></thead>
      <tbody>
        {nodes.flatMap((n) => [
          <tr key={n.id ?? "none"}>
            <td className="font-medium">{n.name}</td>
            <td className="num"><Money cents={n.totalCents} /></td>
            <td className="num">{pct(n.share)}</td>
            <td className="num"><Money cents={n.previousCents} /></td>
          </tr>,
          ...n.children.map((c) => (
            <tr key={`${n.id}-${c.id}`} className="text-muted-foreground">
              <td className="pl-4">↳ {c.name}</td>
              <td className="num"><Money cents={c.totalCents} /></td>
              <td className="num">{pct(totalCents ? c.totalCents / totalCents : 0)}</td>
              <td />
            </tr>
          )),
        ])}
      </tbody>
    </table>
  );

  return (
    <ChartFrame
      id="categorias"
      title={title}
      description={<>Total de <Money cents={totalCents} />. Toque numa categoria para ver os lançamentos.</>}
      chart={chart}
      table={table}
    />
  );
}

/** Comparação com a média dos 3 meses anteriores: barra (período) + marca (média). */
export function AverageComparison({ nodes, months, monthOnly }: { nodes: CategoryNode[]; months: number; monthOnly?: boolean }) {
  if (monthOnly) {
    return (
      <section aria-labelledby="media-title" className="grid content-start gap-3 rounded-2xl border bg-card p-5 animate-rise">
        <h2 id="media-title" className="text-base font-semibold">Comparação com a média</h2>
        <SectionEmpty icon={PieChart} text="Disponível na visão por mês: escolha um mês para comparar cada categoria com a média dos 3 meses anteriores." />
      </section>
    );
  }
  const rows = nodes
    .filter((n) => n.id !== null && (n.totalCents > 0 || n.averageCents > 0))
    .sort((a, b) => Math.max(b.totalCents, b.averageCents) - Math.max(a.totalCents, a.averageCents))
    .slice(0, 6);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.totalCents, r.averageCents)));
  const avgLabel = months === 1 ? "Média mensal (3 meses anteriores)" : "Média dos 3 meses anteriores × duração do período";

  if (rows.length === 0 || rows.every((r) => r.averageCents === 0)) {
    return (
      <section aria-labelledby="media-title" className="grid content-start gap-3 rounded-2xl border bg-card p-5 animate-rise">
        <h2 id="media-title" className="text-base font-semibold">Comparação com a média</h2>
        <SectionEmpty icon={PieChart} text="Ainda não há 3 meses de histórico para comparar." />
      </section>
    );
  }

  const chart = (
    <ol className="grid gap-3">
      {rows.map((r, i) => {
        const v = variation(r.totalCents, r.averageCents);
        const tone = toneFor("expense", v.direction);
        return (
          <li key={r.id} className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium">{r.name}</span>
              <span className="flex shrink-0 items-baseline gap-2">
                <Money cents={r.totalCents} className="font-semibold" />
                <span className={cn("w-12 text-right text-xs font-semibold", tone === "good" && "text-income", tone === "bad" && "text-expense", tone === "neutral" && "text-muted-foreground")}>
                  {r.averageCents > 0 ? formatPct(v.pct) : "novo"}
                </span>
              </span>
            </div>
            <div aria-hidden className="relative h-2.5 rounded-full bg-surface-2">
              <div className="h-full origin-left rounded-full bg-viz-expense animate-grow-x"
                style={{ width: `${(r.totalCents / max) * 100}%`, animationDelay: `${i * 50}ms` }} />
              {r.averageCents > 0 && (
                <div className="absolute -top-1 h-[1.125rem] w-[3px] -translate-x-1/2 rounded-full bg-foreground ring-2 ring-card"
                  style={{ left: `${(r.averageCents / max) * 100}%` }} />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );

  const table = (
    <table className={tableClass}>
      <caption className="sr-only">Comparação com a média dos últimos 3 meses</caption>
      <thead><tr><th>Categoria</th><th className="num">Período</th><th className="num">Média</th><th className="num">Variação</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="font-medium">{r.name}</td>
            <td className="num"><Money cents={r.totalCents} /></td>
            <td className="num"><Money cents={r.averageCents} /></td>
            <td className="num">{r.averageCents > 0 ? formatPct(variation(r.totalCents, r.averageCents).pct) : "novo"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartFrame
      id="media"
      title="Comparação com a média"
      description="Gasto do período por categoria contra a média dos 3 meses anteriores."
      legend={
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          <LegendItem color="var(--viz-expense)" label="Este período" />
          <LegendItem color="var(--foreground)" label={avgLabel} kind="tick" />
        </ul>
      }
      chart={chart}
      table={table}
    />
  );
}

export function SectionEmpty({ icon: Icon, text, children }: { icon: React.ComponentType<{ className?: string }>; text: string; children?: React.ReactNode }) {
  return (
    <div className="grid justify-items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center">
      <span className="grid size-10 place-items-center rounded-xl bg-surface-2 text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="text-sm text-muted-foreground">{text}</p>
      {children}
    </div>
  );
}
