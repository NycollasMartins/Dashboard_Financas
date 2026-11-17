import { addMonths, daysInMonth, formatMonthTitle, monthStart, type ISODate } from "@/lib/dates";

/*
 * Período do dashboard (RN-61). Puro e testado: a página só traduz a URL.
 *   ?periodo=2026-11            → mês (padrão: mês atual)
 *   ?ano=2026                   → ano inteiro
 *   ?de=2026-01-15&ate=2026-03-10 → intervalo personalizado (até 36 meses)
 */

export type PeriodKind = "month" | "year" | "range";
export type DateRange = { from: ISODate; to: ISODate };

export type Period = DateRange & {
  kind: PeriodKind;
  /** Rótulo curto: "Novembro de 2026", "2026", "15/01/2026 – 10/03/2026". */
  label: string;
  /** Período anterior de mesmo tamanho (para as setas de variação). */
  previous: DateRange;
  /** Os 3 meses inteiros antes do início (média por categoria). */
  average: DateRange;
  /** Janela dos gráficos de evolução: 12 meses terminando no fim do período. */
  trend: DateRange;
  /** Quantos meses o período cobre (≥ 1), usado para comparar com a média mensal. */
  months: number;
};

export type PeriodParams = { periodo?: string; ano?: string; de?: string; ate?: string };

const MAX_RANGE_MONTHS = 36;

export function endOfMonth(month: ISODate): ISODate {
  return (`${month.slice(0, 7)}-${String(daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)))).padStart(2, "0")}`) as ISODate;
}

export function addDays(date: ISODate, n: number): ISODate {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10) as ISODate;
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

function monthsSpanned(from: ISODate, to: ISODate): number {
  return (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) + 1;
}

function isValidDate(s: string | undefined): s is ISODate {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  return y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

const br = (d: ISODate) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

function build(kind: PeriodKind, from: ISODate, to: ISODate, label: string): Period {
  const months = monthsSpanned(from, to);
  let previous: DateRange;
  if (kind === "month") {
    const p = addMonths(from, -1);
    previous = { from: p, to: endOfMonth(p) };
  } else if (kind === "year") {
    previous = { from: addMonths(from, -12), to: endOfMonth(addMonths(monthStart(to), -12)) };
  } else {
    const len = daysBetween(from, to) + 1;
    previous = { from: addDays(from, -len), to: addDays(from, -1) };
  }
  const startMonth = monthStart(from);
  const average = { from: addMonths(startMonth, -3), to: addDays(startMonth, -1) };
  const trendEnd = monthStart(to);
  const trend = { from: addMonths(trendEnd, -11), to: endOfMonth(trendEnd) };
  return { kind, from, to, label, previous, average, trend, months };
}

/** Lê os parâmetros (já vindos da URL) e devolve o período. Valores inválidos → mês atual. */
export function resolvePeriod(params: PeriodParams, today: ISODate): Period {
  if (isValidDate(params.de) && isValidDate(params.ate) && params.de <= params.ate &&
      monthsSpanned(params.de, params.ate) <= MAX_RANGE_MONTHS) {
    return build("range", params.de, params.ate, `${br(params.de)} – ${br(params.ate)}`);
  }
  if (params.ano && /^\d{4}$/.test(params.ano) && +params.ano >= 2000 && +params.ano <= 2100) {
    return build("year", `${params.ano}-01-01` as ISODate, `${params.ano}-12-31` as ISODate, params.ano);
  }
  const month = params.periodo && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.periodo)
    ? (`${params.periodo}-01` as ISODate)
    : monthStart(today);
  return build("month", month, endOfMonth(month), formatMonthTitle(month));
}

/** O período contém hoje? (só aí faz sentido "projeção" e "falta receber"). */
export function isCurrent(period: DateRange, today: ISODate) {
  return period.from <= today && today <= period.to;
}
