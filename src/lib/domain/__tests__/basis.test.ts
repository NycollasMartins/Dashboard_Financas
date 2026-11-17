import { describe, expect, it } from "vitest";
import type { ISODate } from "@/lib/dates";
import { installmentDate, installmentInvoice } from "../invoice";
import { bucketDate } from "../basis";

/* Mesmos casos de supabase/tests/database/06_phase3_analytics.test.sql:
 * cartão fecha dia 3 e vence dia 10; 3x a partir de 20/11/2025. */

describe("bucketDate (competência × caixa)", () => {
  const parcels = [1, 2, 3].map((k) => ({
    occurredOn: installmentDate("2025-11-20", k),
    paymentMethod: "credit",
    // mês da fatura (YYYY-MM-01) + dia de vencimento 10
    invoiceDueDate: `${installmentInvoice(3, 10, "2025-11-20", k).slice(0, 8)}10` as ISODate,
  }));

  it("competência: cada parcela no mês da própria data", () => {
    expect(parcels.map((p) => bucketDate(p, "accrual"))).toEqual(["2025-11-20", "2025-12-20", "2026-01-20"]);
  });
  it("caixa: cada parcela no vencimento da sua fatura (cruza o ano)", () => {
    expect(parcels.map((p) => bucketDate(p, "cash"))).toEqual(["2025-12-10", "2026-01-10", "2026-02-10"]);
  });
  it("fora do cartão as duas visões coincidem", () => {
    const pix = { occurredOn: "2025-01-10" as const, paymentMethod: "pix" };
    expect(bucketDate(pix, "cash")).toBe(bucketDate(pix, "accrual"));
  });
  it("crédito sem fatura é erro de dados", () => {
    expect(() => bucketDate({ occurredOn: "2025-01-10", paymentMethod: "credit" }, "cash")).toThrow();
  });
});
