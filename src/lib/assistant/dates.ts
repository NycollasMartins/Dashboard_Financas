import { addMonths, clampedDate, daysInMonth, monthStart, type ISODate } from "@/lib/dates";
import { addDays, endOfMonth } from "@/lib/analytics/period";

/*
 * Datas relativas em português (texto normalizado), sempre a partir de "hoje"
 * em São Paulo: hoje, ontem, anteontem, "dia 5", "05/11", "5/11/2026",
 * "segunda"…"domingo" (+ "passada"), "semana passada". Puro e testado.
 */

const WEEKDAYS: Record<string, number> = {
  domingo: 0, segunda: 1, "segunda-feira": 1, terca: 2, "terca-feira": 2, quarta: 3, "quarta-feira": 3,
  quinta: 4, "quinta-feira": 4, sexta: 5, "sexta-feira": 5, sabado: 6,
};
const MONTHS: Record<string, number> = {
  janeiro: 1, jan: 1, fevereiro: 2, fev: 2, marco: 3, mar: 3, abril: 4, abr: 4, maio: 5, mai: 5, junho: 6, jun: 6,
  julho: 7, jul: 7, agosto: 8, ago: 8, setembro: 9, set: 9, outubro: 10, out: 10, novembro: 11, nov: 11, dezembro: 12, dez: 12,
};

const weekday = (d: ISODate) => new Date(`${d}T12:00:00Z`).getUTCDay();

export type DateMatch = { date: ISODate; start: number; end: number };

export function findDate(text: string, today: ISODate): DateMatch | null {
  let m: RegExpExecArray | null;
  if ((m = /\b(anteontem|antes de ontem)\b/.exec(text))) return { date: addDays(today, -2), start: m.index, end: m.index + m[0].length };
  if ((m = /\bontem\b/.exec(text))) return { date: addDays(today, -1), start: m.index, end: m.index + m[0].length };
  if ((m = /\bhoje\b/.exec(text))) return { date: today, start: m.index, end: m.index + m[0].length };
  if ((m = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(text))) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : Number(today.slice(0, 4));
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo)) {
      let date = clampedDate(y, mo, d);
      if (!m[3] && date > today) date = clampedDate(--y, mo, d); // "05/12" em novembro = dezembro passado
      return { date, start: m.index, end: m.index + m[0].length };
    }
  }
  if ((m = /\bdia (\d{1,2})(?: de (janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro))?\b/.exec(text))) {
    const d = Number(m[1]);
    if (d >= 1 && d <= 31) {
      const [y, mo] = today.split("-").map(Number);
      if (m[2]) {
        let year = y;
        if (MONTHS[m[2]] > mo) year -= 1;
        return { date: clampedDate(year, MONTHS[m[2]], d), start: m.index, end: m.index + m[0].length };
      }
      // "dia 20" no dia 17 = dia 20 do mês PASSADO (gasto não é no futuro)
      let date = clampedDate(y, mo, d);
      if (date > today) {
        const prev = addMonths(monthStart(today), -1);
        date = clampedDate(Number(prev.slice(0, 4)), Number(prev.slice(5, 7)), d);
      }
      return { date, start: m.index, end: m.index + m[0].length };
    }
  }
  if ((m = /\b(?:na |no |nessa |nesse |essa |esse |ultima |ultimo )?(domingo|segunda(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado)( passad[ao])?\b/.exec(text))) {
    const target = WEEKDAYS[m[1]];
    const passada = Boolean(m[2]);
    let diff = (weekday(today) - target + 7) % 7;
    if (passada && diff === 0) diff = 7;
    return { date: addDays(today, -diff), start: m.index, end: m.index + m[0].length };
  }
  return null;
}

export type PeriodKey = "hoje" | "semana" | "semana_passada" | "mes" | "mes_passado" | "ano" | "mes_nomeado";
export type Period = { key: PeriodKey; from: ISODate; to: ISODate; label: string };

const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Período de uma consulta ("quanto gastei semana passada?"). Padrão: este mês. */
export function findPeriod(text: string, today: ISODate): Period {
  const m0 = monthStart(today);
  const label = (m: ISODate) => `${monthNames[Number(m.slice(5, 7)) - 1]}`;
  if (/\bhoje\b/.test(text)) return { key: "hoje", from: today, to: today, label: "hoje" };
  if (/\bsemana passada\b/.test(text)) {
    const start = addDays(today, -((weekday(today) + 6) % 7) - 7);
    return { key: "semana_passada", from: start, to: addDays(start, 6), label: "na semana passada" };
  }
  if (/\b(essa|esta|nessa|nesta) semana\b|\bna semana\b/.test(text)) {
    const start = addDays(today, -((weekday(today) + 6) % 7));
    return { key: "semana", from: start, to: today, label: "nesta semana" };
  }
  if (/\bmes passado\b|\bultimo mes\b/.test(text)) {
    const p = addMonths(m0, -1);
    return { key: "mes_passado", from: p, to: endOfMonth(p), label: `em ${label(p)}` };
  }
  if (/\b(esse|este|neste|nesse) ano\b|\bno ano\b/.test(text)) {
    return { key: "ano", from: `${today.slice(0, 4)}-01-01` as ISODate, to: today, label: `em ${today.slice(0, 4)}` };
  }
  const named = /\b(?:em|no mes de|de) (janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/.exec(text);
  if (named) {
    const mo = MONTHS[named[1]];
    let y = Number(today.slice(0, 4));
    if (mo > Number(today.slice(5, 7))) y -= 1;
    const m = `${y}-${String(mo).padStart(2, "0")}-01` as ISODate;
    return { key: "mes_nomeado", from: m, to: endOfMonth(m), label: `em ${label(m)}` };
  }
  return { key: "mes", from: m0, to: endOfMonth(m0), label: `em ${label(m0)}` };
}

/** Data vinda da IA: ISO ("2026-11-16") ou texto relativo ("ontem"). */
export function parseDateValue(value: unknown, today: ISODate): ISODate | null {
  if (typeof value !== "string" || !value.trim()) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const v = value.trim() as ISODate;
    return v > today ? null : v;
  }
  return findDate(value.toLowerCase(), today)?.date ?? null;
}
