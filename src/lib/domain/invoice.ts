import { addMonths, clampedDate, type ISODate } from "@/lib/dates";

/**
 * Regra da fatura (RN-10) — espelho de private.invoice_cycle no banco.
 * O banco é quem grava; esta versão serve para a interface PREVER a fatura
 * ("cai na fatura de dezembro, vence 10/12") antes de salvar.
 */
export type InvoiceCycle = { referenceMonth: ISODate; closingDate: ISODate; dueDate: ISODate };

function ym(date: ISODate) {
  const [y, m] = date.split("-").map(Number);
  return { y, m };
}

export function invoiceCycle(closingDay: number, dueDay: number, purchaseDate: ISODate): InvoiceCycle {
  const { y, m } = ym(purchaseDate);
  const closingThisMonth = clampedDate(y, m, closingDay);
  // Compra NO dia do fechamento ou depois → próximo ciclo.
  const closingMonth = purchaseDate >= closingThisMonth ? addMonths(`${y}-${pad(m)}-01` as ISODate, 1) : (`${y}-${pad(m)}-01` as ISODate);
  const dueMonth = dueDay > closingDay ? closingMonth : addMonths(closingMonth, 1);
  const c = ym(closingMonth);
  const d = ym(dueMonth);
  return {
    referenceMonth: dueMonth,
    closingDate: clampedDate(c.y, c.m, closingDay),
    dueDate: clampedDate(d.y, d.m, dueDay),
  };
}

/** Fatura da parcela k (1..N) de uma compra. */
export function installmentInvoice(closingDay: number, dueDay: number, purchaseDate: ISODate, k: number): ISODate {
  return addMonths(invoiceCycle(closingDay, dueDay, purchaseDate).referenceMonth, k - 1);
}

/** Competência da parcela k = data da compra + (k−1) meses, com o dia preso ao fim do mês. */
export function installmentDate(purchaseDate: ISODate, k: number): ISODate {
  const { y, m } = ym(addMonths(`${purchaseDate.slice(0, 7)}-01` as ISODate, k - 1));
  return clampedDate(y, m, Number(purchaseDate.slice(8, 10)));
}

export type InvoiceStatus = "open" | "closed" | "paid" | "overdue";

/** Status calculado (RN-54) — espelho da view card_invoice_summaries. */
export function invoiceStatus(
  inv: { closingDate: ISODate; dueDate: ISODate; totalCents: number; paidCents: number },
  today: ISODate,
): InvoiceStatus {
  if (inv.totalCents > 0 && inv.paidCents >= inv.totalCents) return "paid";
  if (today > inv.dueDate && inv.totalCents > inv.paidCents) return "overdue";
  if (today >= inv.closingDate) return "closed";
  return "open";
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
