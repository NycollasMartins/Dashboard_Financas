/**
 * Datas de competência são strings "YYYY-MM-DD" (tipo `date` no Postgres),
 * sempre interpretadas no fuso America/Sao_Paulo.
 */
export const APP_TIMEZONE = "America/Sao_Paulo";

export type ISODate = `${number}-${number}-${number}`;

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "Hoje" no fuso de São Paulo, como YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): ISODate {
  return ymdFormatter.format(now) as ISODate;
}

/** Primeiro dia do mês da data: "2026-11-17" → "2026-11-01". */
export function monthStart(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01` as ISODate;
}

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

/**
 * Data no mês indicado com o dia "preso" ao último dia do mês.
 * Ex.: dia 31 em fevereiro/2026 → 2026-02-28.
 */
export function clampedDate(year: number, month1to12: number, day: number): ISODate {
  const d = Math.min(day, daysInMonth(year, month1to12));
  return `${year}-${String(month1to12).padStart(2, "0")}-${String(d).padStart(2, "0")}` as ISODate;
}

/** Soma meses a um mês de referência "YYYY-MM-01". */
export function addMonths(month: ISODate, n: number): ISODate {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01` as ISODate;
}

const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

/** "2026-11-01" → "novembro de 2026" */
export function formatMonth(month: ISODate): string {
  const [y, m] = month.split("-").map(Number);
  return monthLabel.format(new Date(Date.UTC(y, m - 1, 1)));
}
