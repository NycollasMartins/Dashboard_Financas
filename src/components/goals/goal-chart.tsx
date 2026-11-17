"use client";

import { useState } from "react";
import { ChartFrame, LegendItem, tableClass } from "@/components/dashboard/chart-frame";
import { axisBRL, niceTicks } from "@/components/dashboard/scale";
import { usePrivacyHidden } from "@/components/privacy/privacy";
import { addMonths, formatMonthShort, formatMonthTitle, type ISODate } from "@/lib/dates";
import type { SeriesPoint } from "@/lib/goals/math";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

const H = 220;

/**
 * Evolução da meta: realizado (linha cheia), projetado no ritmo atual
 * (tracejado — é estimativa), linha ideal até o prazo (fina) e o alvo.
 * Um eixo só em R$; tabela alternativa no botão.
 */
export function GoalChart({
  realized,
  projected,
  ideal,
  targetCents,
  color,
}: {
  realized: SeriesPoint[];
  projected: SeriesPoint[];
  ideal: SeriesPoint[];
  targetCents: number;
  color: string;
}) {
  const hidden = usePrivacyHidden();
  const [active, setActive] = useState<number | null>(null);
  const all = [...realized, ...projected, ...ideal];
  const first = realized[0]?.month ?? ideal[0]?.month ?? projected[0]?.month;
  const last = all.reduce((m, p) => (p.month > m ? p.month : m), first ?? "");
  if (!first) return null;
  const months: ISODate[] = [];
  for (let m = first as ISODate; m <= last && months.length < 160; m = addMonths(m, 1)) months.push(m);
  const n = Math.max(1, months.length - 1);
  const idx = (m: string) => months.indexOf(m.slice(0, 10) as ISODate);
  const maxV = Math.max(targetCents, ...all.map((p) => p.cents)) * 1.05;
  const ticks = niceTicks(0, maxV, 4);
  const hi = ticks.at(-1)!;
  const x = (i: number) => (i / n) * 1000;
  const y = (v: number) => 300 - (v / hi) * 300;
  const path = (s: SeriesPoint[]) => s.map((p) => `${x(idx(p.month))},${y(p.cents)}`).join(" ");
  const valueAt = (s: SeriesPoint[], m: ISODate) => s.find((p) => p.month.slice(0, 7) === m.slice(0, 7))?.cents;
  const money = (c: number | undefined) => (c === undefined ? "—" : hidden ? "R$ ••••" : formatBRL(c));
  const step = Math.max(1, Math.ceil(months.length / 6));

  const chart = (
    <figure className="m-0 grid gap-2">
      <figcaption className="sr-only">
        Guardado mês a mês até hoje, projeção no ritmo atual e linha ideal até o prazo. Use a tabela para ler os valores.
      </figcaption>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
        <div aria-hidden className="relative w-12 text-right text-[10px] text-muted-foreground sm:w-14" style={{ height: H }}>
          {!hidden && ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2 leading-none text-money" style={{ bottom: `${(t / hi) * 100}%` }}>{axisBRL(t)}</span>
          ))}
        </div>
        <div className="relative" style={{ height: H }} onMouseLeave={() => setActive(null)}>
          {ticks.map((t) => (
            <div key={t} aria-hidden className="absolute inset-x-0 h-px bg-viz-grid" style={{ bottom: `${(t / hi) * 100}%` }} />
          ))}
          <div aria-hidden className="absolute inset-x-0 border-t border-foreground/40" style={{ bottom: `${(targetCents / hi) * 100}%` }}>
            <span className="absolute -top-4 right-0 text-[10px] font-semibold text-muted-foreground">Alvo</span>
          </div>
          <svg aria-hidden className="absolute inset-0 size-full overflow-visible" viewBox="0 0 1000 300" preserveAspectRatio="none">
            {ideal.length > 1 && <polyline points={path(ideal)} fill="none" stroke="var(--muted-foreground)" strokeOpacity={0.6} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
            {projected.length > 1 && <polyline points={path(projected)} fill="none" stroke={color} strokeWidth={2} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />}
            {realized.length > 0 && <polyline points={path(realized)} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
          </svg>
          {realized.at(-1) && (
            <span aria-hidden className="absolute size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full ring-2 ring-card"
              style={{ left: `${(idx(realized.at(-1)!.month) / n) * 100}%`, bottom: `${(realized.at(-1)!.cents / hi) * 100}%`, background: color }} />
          )}
          <ol className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }} aria-hidden>
            {months.map((m, i) => (
              <li key={m} onMouseEnter={() => setActive(i)} className={cn("h-full", active === i && "bg-foreground/[0.04]")} />
            ))}
          </ol>
          {active !== null && (
            <div className="pointer-events-none absolute top-0 z-10 w-48 rounded-xl border bg-popover p-3 text-xs shadow-xl"
              style={{ left: `clamp(0px, calc(${(active / n) * 100}% - 6rem), calc(100% - 12rem))` }}>
              <p className="mb-1 font-semibold">{formatMonthTitle(months[active])}</p>
              {valueAt(realized, months[active]) !== undefined && <p className="flex justify-between gap-2"><span>Guardado</span><span className="text-money font-medium">{money(valueAt(realized, months[active]))}</span></p>}
              {valueAt(projected, months[active]) !== undefined && <p className="flex justify-between gap-2"><span>Projeção</span><span className="text-money font-medium">{money(valueAt(projected, months[active]))}</span></p>}
              {valueAt(ideal, months[active]) !== undefined && <p className="flex justify-between gap-2 text-muted-foreground"><span>Ideal</span><span className="text-money">{money(valueAt(ideal, months[active]))}</span></p>}
            </div>
          )}
        </div>
        <div />
        <ol aria-hidden className="relative mt-1.5 h-6 text-[10px] text-muted-foreground">
          {months.map((m, i) => (i % step === 0 || i === months.length - 1) && (
            <li key={m} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${(i / n) * 100}%` }}>{formatMonthShort(m)}</li>
          ))}
        </ol>
      </div>
    </figure>
  );

  const table = (
    <table className={tableClass}>
      <caption className="sr-only">Evolução da meta mês a mês</caption>
      <thead><tr><th>Mês</th><th className="num">Guardado</th><th className="num">Projeção</th><th className="num">Ideal</th></tr></thead>
      <tbody>
        {months.map((m) => (
          <tr key={m}>
            <td>{formatMonthTitle(m)}</td>
            <td className="num">{money(valueAt(realized, m))}</td>
            <td className="num">{money(valueAt(projected, m))}</td>
            <td className="num">{money(valueAt(ideal, m))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartFrame
      id="evolucao-meta"
      title="Evolução"
      description="Linha cheia: o que já foi guardado. Tracejada: estimativa no ritmo atual (não é garantia)."
      legend={
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          <LegendItem color={color} label="Guardado" kind="line" />
          {projected.length > 1 && <LegendItem color={color} label="Projeção (tracejada)" kind="line" />}
          {ideal.length > 1 && <LegendItem color="var(--muted-foreground)" label="Ritmo ideal até o prazo" kind="line" />}
        </ul>
      }
      chart={chart}
      table={table}
    />
  );
}
