import type { ISODate } from "@/lib/dates";

/*
 * Visões de período (ADR-0014). Espelho de public.analytics_entries (SQL):
 *   competência ("accrual") → a data do lançamento (compra, parcela, recebimento);
 *   caixa ("cash")          → crédito: vencimento da fatura; demais: a data do lançamento.
 * Mesmos casos de teste em supabase/tests/database/06_phase3_analytics.test.sql.
 */

export type Basis = "accrual" | "cash";

export type BasisEntry = {
  occurredOn: ISODate;
  paymentMethod: string;
  /** Vencimento da fatura (só crédito). */
  invoiceDueDate?: ISODate | null;
};

export function bucketDate(entry: BasisEntry, basis: Basis): ISODate {
  if (basis === "cash" && entry.paymentMethod === "credit") {
    if (!entry.invoiceDueDate) throw new Error("Compra no crédito sem fatura.");
    return entry.invoiceDueDate;
  }
  return entry.occurredOn;
}

/** URL ↔ banco: "competencia"/"caixa" na URL (pt-BR), "accrual"/"cash" no SQL. */
export const BASIS_FROM_PARAM: Record<string, Basis> = { competencia: "accrual", caixa: "cash" };
export const BASIS_TO_PARAM: Record<Basis, string> = { accrual: "competencia", cash: "caixa" };
export const BASIS_LABEL: Record<Basis, string> = { accrual: "Competência", cash: "Caixa" };
