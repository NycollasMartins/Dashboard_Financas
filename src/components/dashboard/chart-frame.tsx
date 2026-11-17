"use client";

import { useState } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Moldura padrão de gráfico: título, legenda e a alternância Gráfico ↔ Tabela.
 * A tabela é a alternativa acessível (leitor de tela, daltonismo, impressão)
 * e mostra todos os valores — o tooltip nunca é o único jeito de ler um número.
 */
export function ChartFrame({
  id,
  title,
  description,
  legend,
  chart,
  table,
  className,
  actions,
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  legend?: React.ReactNode;
  chart: React.ReactNode;
  table: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section aria-labelledby={`${id}-title`} className={cn("grid min-w-0 content-start gap-4 rounded-2xl border bg-card p-4 animate-rise sm:p-5", className)}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          <button
            type="button"
            onClick={() => setView((v) => (v === "chart" ? "table" : "chart"))}
            aria-pressed={view === "table"}
            aria-label={view === "chart" ? `Ver ${title} como tabela` : `Ver ${title} como gráfico`}
            className="grid size-11 place-items-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {view === "chart" ? <Table2 className="size-4" /> : <BarChart3 className="size-4" />}
          </button>
        </div>
      </header>
      {view === "chart" ? (
        <>
          {legend}
          {chart}
        </>
      ) : (
        <div className="-mx-1 overflow-x-auto">{table}</div>
      )}
    </section>
  );
}

export function LegendItem({ color, label, kind = "square" }: { color: string; label: string; kind?: "square" | "line" | "tick" }) {
  return (
    <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden
        className={cn(
          "inline-block shrink-0",
          kind === "square" && "size-2.5 rounded-[3px]",
          kind === "line" && "h-0.5 w-3.5 rounded-full",
          kind === "tick" && "h-3 w-0.5 rounded-full",
        )}
        style={{ background: color }}
      />
      {label}
    </li>
  );
}

export const tableClass = "w-full min-w-[20rem] text-left text-sm [&_td]:py-2 [&_td]:pr-3 [&_th]:pb-2 [&_th]:pr-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground [&_tbody_tr]:border-t [&_td.num]:text-right [&_th.num]:text-right [&_td.num]:text-money";
