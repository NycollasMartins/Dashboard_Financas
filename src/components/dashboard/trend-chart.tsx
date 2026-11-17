"use client";

import { useState } from "react";
import { usePrivacy } from "@/components/privacy/privacy";
import { formatMonthShort, formatMonthTitle, type ISODate } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ChartFrame, LegendItem, tableClass } from "./chart-frame";
import { useDashboardNav } from "./dashboard-nav";
import { axisBRL, niceTicks } from "./scale";

export type TrendPoint = {
  month: string;
  incomeCents: number;
  incomePlannedCents: number;
  expenseCents: number;
  expensePlannedCents: number;
};

const PLOT_H = 200; // px — o eixo X fica FORA desta altura (não corta rótulos)

/**
 * Evolução de 12 meses: receitas × despesas (barras, previsto mais claro em
 * cima do realizado) e saldo (linha). Um eixo só, em R$ (nada de eixo duplo).
 * Tocar/clicar numa coluna abre aquele mês no painel.
 */
export function TrendChart({ points, selected, basisLabel }: { points: TrendPoint[]; selected: string[]; basisLabel: string }) {
  const { hidden } = usePrivacy();
  const { go } = useDashboardNav();
  const [active, setActive] = useState<number | null>(null);

  const rows = points.map((p) => {
    const inc = p.incomeCents + p.incomePlannedCents;
    const exp = p.expenseCents + p.expensePlannedCents;
    return { ...p, inc, exp, balance: inc - exp };
  });
  const maxV = Math.max(1, ...rows.map((r) => Math.max(r.inc, r.exp)));
  const minV = Math.min(0, ...rows.map((r) => r.balance));
  const ticks = niceTicks(minV, maxV, 3);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const y = (v: number) => ((v - lo) / (hi - lo)) * 100; // % a partir de baixo
  const zero = y(0);
  const n = rows.length;
  const empty = rows.every((r) => r.inc === 0 && r.exp === 0);
  const linePoints = rows.map((r, i) => `${((i + 0.5) / n) * 1000},${100 - y(r.balance)}`).join(" ");
  const money = (c: number, opts?: { signed?: boolean }) => (hidden ? "R$ ••••" : formatBRL(c, opts));

  const summary = empty
    ? "Sem lançamentos nos últimos 12 meses."
    : `Receitas, despesas e saldo de ${formatMonthTitle(rows[0].month as ISODate)} a ${formatMonthTitle(rows[n - 1].month as ISODate)}.`;

  const chart = (
    <figure className="m-0 grid gap-2">
      <figcaption className="sr-only">{summary} Use a opção de tabela para ler todos os valores.</figcaption>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
        {/* Eixo Y */}
        <div aria-hidden className="relative w-12 text-right text-[10px] text-muted-foreground sm:w-14" style={{ height: PLOT_H }}>
          {!hidden && ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2 text-money leading-none" style={{ bottom: `${y(t)}%` }}>
              {axisBRL(t)}
            </span>
          ))}
        </div>
        <div className="relative" style={{ height: PLOT_H }} onMouseLeave={() => setActive(null)}>
          {/* Grade */}
          {ticks.map((t) => (
            <div key={t} aria-hidden className={cn("absolute inset-x-0 h-px", t === 0 ? "bg-muted-foreground/30" : "bg-viz-grid")} style={{ bottom: `${y(t)}%` }} />
          ))}
          {/* Colunas (área de toque = coluna inteira) */}
          <ol className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {rows.map((r, i) => {
              const isSel = selected.includes(r.month.slice(0, 7));
              return (
                <li key={r.month} className="relative">
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    onClick={() => go({ periodo: r.month.slice(0, 7) })}
                    aria-label={`${formatMonthTitle(r.month as ISODate)}: receitas ${money(r.inc)}, despesas ${money(r.exp)}, saldo ${money(r.balance)}. Abrir este mês.`}
                    className={cn(
                      "absolute inset-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      (isSel || active === i) && "bg-foreground/[0.04]",
                    )}
                  />
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 flex items-end justify-center gap-[2px]"
                    style={{ bottom: `${zero}%`, height: `${100 - zero}%` }}>
                    {(["income", "expense"] as const).map((k) => {
                      const real = k === "income" ? r.incomeCents : r.expenseCents;
                      const plan = k === "income" ? r.incomePlannedCents : r.expensePlannedCents;
                      const total = real + plan;
                      const h = (total / hi) * 100; // % da área acima do zero
                      return (
                        <div key={k} className="flex w-[min(40%,10px)] origin-bottom flex-col animate-grow-y"
                          style={{ height: `${Math.max(total > 0 ? 1 : 0, h)}%`, animationDelay: `${i * 35}ms` }}>
                          {plan > 0 && (
                            <div className={cn("w-full rounded-t-[4px] opacity-40", k === "income" ? "bg-viz-income" : "bg-viz-expense", real > 0 && "mb-[2px]")}
                              style={{ flex: plan }} />
                          )}
                          {real > 0 && (
                            <div className={cn("w-full", plan > 0 ? "" : "rounded-t-[4px]", k === "income" ? "bg-viz-income" : "bg-viz-expense")}
                              style={{ flex: real }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ol>
          {/* Linha do saldo */}
          {!empty && (
            <svg aria-hidden className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox="0 0 1000 100" preserveAspectRatio="none">
              <polyline points={linePoints} fill="none" stroke="var(--viz-balance)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          )}
          {!empty && rows.map((r, i) => (
            <span key={r.month} aria-hidden
              className={cn("pointer-events-none absolute size-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-viz-balance ring-2 ring-card", active === i && "size-2.5")}
              style={{ left: `${((i + 0.5) / n) * 100}%`, bottom: `${y(r.balance)}%` }} />
          ))}
          {/* Tooltip */}
          {active !== null && (
            <div role="presentation"
              className="pointer-events-none absolute top-0 z-10 w-44 rounded-xl border bg-popover p-3 text-xs shadow-xl"
              style={{ left: `clamp(0px, calc(${((active + 0.5) / n) * 100}% - 5.5rem), calc(100% - 11rem))` }}>
              <p className="mb-1.5 font-semibold">{formatMonthTitle(rows[active].month as ISODate)}</p>
              <TipRow color="var(--viz-income)" label="Receitas" value={money(rows[active].inc)} sub={rows[active].incomePlannedCents > 0 ? `${money(rows[active].incomePlannedCents)} previsto` : undefined} />
              <TipRow color="var(--viz-expense)" label="Despesas" value={money(rows[active].exp)} sub={rows[active].expensePlannedCents > 0 ? `${money(rows[active].expensePlannedCents)} previsto` : undefined} />
              <TipRow color="var(--viz-balance)" label="Saldo" value={money(rows[active].balance, { signed: true })} />
            </div>
          )}
          {empty && (
            <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Sem lançamentos nos últimos 12 meses.</p>
          )}
        </div>
        {/* Eixo X */}
        <div />
        <ol aria-hidden className="mt-1.5 grid text-center text-[10px] text-muted-foreground" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {rows.map((r, i) => {
            const [name, yy] = formatMonthShort(r.month as ISODate).split("/");
            return (
              <li key={r.month} className={cn("truncate", selected.includes(r.month.slice(0, 7)) && "font-semibold text-foreground")}>
                {n > 6 && (n - 1 - i) % 2 === 1 && r.month.slice(5, 7) !== "01" ? <span className="hidden sm:inline">{name}</span> : name}
                {(r.month.slice(5, 7) === "01" || i === 0) && <span className="block opacity-70">{yy}</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </figure>
  );

  const table = (
    <table className={tableClass}>
      <caption className="sr-only">Evolução mensal — {basisLabel}</caption>
      <thead>
        <tr><th>Mês</th><th className="num">Receitas</th><th className="num">Despesas</th><th className="num">Saldo</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.month}>
            <td>{formatMonthTitle(r.month as ISODate)}</td>
            <td className="num">{money(r.inc)}</td>
            <td className="num">{money(r.exp)}</td>
            <td className="num">{money(r.balance, { signed: true })}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartFrame
      id="evolucao"
      title="Evolução em 12 meses"
      description={`Visão ${basisLabel.toLowerCase()}. Barras claras = previsto. Toque num mês para abri-lo.`}
      legend={
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          <LegendItem color="var(--viz-income)" label="Receitas" />
          <LegendItem color="var(--viz-expense)" label="Despesas" />
          <LegendItem color="var(--viz-balance)" label="Saldo (receitas − despesas)" kind="line" />
        </ul>
      }
      chart={chart}
      table={table}
    />
  );
}

function TipRow({ color, label, value, sub }: { color: string; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-2 py-0.5">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className="size-2 rounded-[3px]" style={{ background: color }} />
        {label}
      </span>
      <span className="text-right text-money font-medium">
        {value}
        {sub && <span className="block text-[10px] font-normal text-muted-foreground">{sub}</span>}
      </span>
    </div>
  );
}
