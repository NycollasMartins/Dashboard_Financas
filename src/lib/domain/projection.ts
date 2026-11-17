import { addMonths, type ISODate } from "@/lib/dates";
import { addDays } from "@/lib/analytics/period";
import { recurrenceDates, type Frequency } from "./recurrence";

/*
 * Motor de projeção (ADR-0017) — espelho de private.projected_occurrences.
 * Ocorrências VIRTUAIS de uma recorrência ativa: só as datas DEPOIS do que o
 * banco já gerou (last_generated_on), até `to` (no máximo 37 meses à frente).
 * Mesmos casos em supabase/tests/database/07_phase4_goals.test.sql.
 */

export type ProjectionRule = {
  frequency: Frequency;
  dayOfMonth: number;
  startsOn: ISODate;
  endsOn?: ISODate | null;
  isActive: boolean;
  lastGeneratedOn: ISODate | null;
};

export const MAX_PROJECTION_MONTHS = 37;

export function projectedDates(rule: ProjectionRule, from: ISODate, to: ISODate, today: ISODate): ISODate[] {
  if (!rule.isActive) return [];
  const afterGenerated = addDays(rule.lastGeneratedOn ?? addDays(rule.startsOn, -1), 1);
  const start = from > afterGenerated ? from : afterGenerated;
  const cap = addMonths(`${today.slice(0, 7)}-01` as ISODate, MAX_PROJECTION_MONTHS);
  const end = to < cap ? to : cap;
  return recurrenceDates(rule, start, end);
}

/** Valor mensal equivalente de uma recorrência (semanal ×52/12, anual ÷12), em centavos inteiros. */
export function monthlyEquivalent(amountCents: number, frequency: Frequency): number {
  if (frequency === "weekly") return Math.round((amountCents * 52) / 12);
  if (frequency === "yearly") return Math.round(amountCents / 12);
  return amountCents;
}
