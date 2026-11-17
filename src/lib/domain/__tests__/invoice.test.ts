import { describe, expect, it } from "vitest";
import { installmentDate, installmentInvoice, invoiceCycle, invoiceStatus } from "@/lib/domain/invoice";
import { splitInstallments } from "@/lib/money";

// Mesmos casos de supabase/tests/database/05_phase2_ledger.test.sql
describe("invoiceCycle (RN-10)", () => {
  it.each([
    [3, 10, "2026-11-02", "2026-11-01", "2026-11-03", "2026-11-10", "antes do fechamento"],
    [3, 10, "2026-11-03", "2026-12-01", "2026-12-03", "2026-12-10", "no dia do fechamento → seguinte"],
    [25, 5, "2026-11-10", "2026-12-01", "2026-11-25", "2026-12-05", "vence no mês seguinte ao fechamento"],
    [25, 5, "2026-12-26", "2027-02-01", "2027-01-25", "2027-02-05", "virada de ano"],
    [31, 10, "2026-02-27", "2026-03-01", "2026-02-28", "2026-03-10", "fechamento 31 em fevereiro"],
    [31, 10, "2026-02-28", "2026-04-01", "2026-03-31", "2026-04-10", "último dia de fevereiro = fechamento"],
    [30, 7, "2028-02-29", "2028-04-01", "2028-03-30", "2028-04-07", "bissexto"],
  ] as const)("fecha %i, vence %i, compra %s → %s (%s)", (c, d, date, ref, closing, due, _caso) => {
    void _caso;
    expect(invoiceCycle(c, d, date)).toEqual({ referenceMonth: ref, closingDate: closing, dueDate: due });
  });
});

describe("parcelamento (RN-11)", () => {
  it("parcelas em faturas consecutivas atravessando o ano", () => {
    expect([1, 2, 3].map((k) => installmentInvoice(3, 10, "2026-11-20", k))).toEqual([
      "2026-12-01",
      "2027-01-01",
      "2027-02-01",
    ]);
  });
  it("competência de cada parcela, com dia preso ao fim do mês", () => {
    expect(installmentDate("2027-01-31", 2)).toBe("2027-02-28");
    expect(installmentDate("2026-11-20", 3)).toBe("2027-01-20");
  });
  it("centavos ímpares na primeira parcela", () => {
    expect(splitInstallments(1001, 2)).toEqual([501, 500]);
  });
});

describe("invoiceStatus (RN-54)", () => {
  const inv = { closingDate: "2026-11-03", dueDate: "2026-11-10", totalCents: 5000, paidCents: 0 } as const;
  it("aberta antes do fechamento", () => expect(invoiceStatus(inv, "2026-11-02")).toBe("open"));
  it("fechada a partir do fechamento", () => expect(invoiceStatus(inv, "2026-11-03")).toBe("closed"));
  it("vencida depois do vencimento sem pagamento", () => expect(invoiceStatus(inv, "2026-11-11")).toBe("overdue"));
  it("paga quando pagamentos ≥ total", () =>
    expect(invoiceStatus({ ...inv, paidCents: 5000 }, "2026-11-20")).toBe("paid"));
  it("pagamento parcial ainda vence", () =>
    expect(invoiceStatus({ ...inv, paidCents: 1000 }, "2026-11-20")).toBe("overdue"));
});
