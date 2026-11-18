import { describe, expect, it } from "vitest";
import { EVAL_CONTEXT, EVAL_TODAY } from "../eval/dataset";
import { receiptSchema, receiptSummary, scrubPII, splitByCategory, validateReceipt } from "../media/receipt";

const base = {
  is_receipt: true, legible: true, doc_type: "nfce", merchant: "Supermercado Bom Preço", total: 87.4, date: "2026-11-16",
  payment: "debit", items: [
    { description: "Arroz 5kg", amount: 28.9, category: "Mercado" },
    { description: "Dipirona", amount: 12.5, category: "Saúde" },
    { description: "Leite", amount: 46, category: "Mercado" },
  ],
};
const sp = (t: string) => t.replace(/\u00a0/g, " ");
const ok = (raw: unknown) => {
  const v = validateReceipt(receiptSchema.parse(raw), EVAL_TODAY, EVAL_CONTEXT);
  if (!v.ok) throw new Error(v.reason);
  return v.receipt;
};

describe("privacidade: nada de CPF/CNPJ/contato", () => {
  it("remove CPF, CNPJ, e-mail, telefone e chave aleatória", () => {
    expect(scrubPII("CPF consumidor: 123.456.789-09 Loja X")).toBe("Loja X");
    expect(scrubPII("Padaria 12.345.678/0001-90")).toBe("Padaria");
    expect(scrubPII("Recebedor Ana ana@mail.com (11) 98765-4321")).toBe("Recebedor Ana");
    expect(scrubPII("Chave 123e4567-e89b-12d3-a456-426614174000 Bar")).toBe("Chave Bar");
  });
  it("o estabelecimento e os itens saem limpos; o schema descarta campos extras (ex.: cpf)", () => {
    const r = ok({ ...base, merchant: "Farmácia CNPJ 12.345.678/0001-90", cpf: "123.456.789-09" });
    expect(r.merchant).toBe("Farmácia");
    expect(JSON.stringify(r)).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
    expect(sp(receiptSummary(r))).toBe("[foto] Nota fiscal (NFC-e) · Farmácia · R$ 87,40 · 16/11/2026 · débito · 3 itens");
  });
});

describe("validação", () => {
  it("não é comprovante / ilegível / sem total → pede outra foto", () => {
    expect(validateReceipt(receiptSchema.parse({ ...base, is_receipt: false }), EVAL_TODAY, EVAL_CONTEXT)).toEqual({ ok: false, reason: "not_receipt" });
    expect(validateReceipt(receiptSchema.parse({ ...base, legible: false }), EVAL_TODAY, EVAL_CONTEXT)).toEqual({ ok: false, reason: "illegible" });
    expect(validateReceipt(receiptSchema.parse({ ...base, total: null }), EVAL_TODAY, EVAL_CONTEXT)).toEqual({ ok: false, reason: "no_total" });
    expect(validateReceipt(receiptSchema.parse({ ...base, total: 0 }), EVAL_TODAY, EVAL_CONTEXT)).toEqual({ ok: false, reason: "no_total" });
  });
  it("soma dos itens × total: alerta quando diverge", () => {
    expect(ok(base).warnings).toEqual([]);
    expect(sp(ok({ ...base, total: 80 }).warnings[0])).toMatch(/soma dos itens \(R\$ 87,40\) difere do total \(R\$ 80,00\)/);
  });
  it("data no futuro ou absurda → usa hoje com alerta; antiga → alerta", () => {
    const fut = ok({ ...base, date: "2027-05-01" });
    expect(fut.date).toBeNull();
    expect(fut.warnings[0]).toMatch(/não parece certa/);
    expect(ok({ ...base, date: "2026-08-01" }).warnings[0]).toMatch(/mais de 60 dias/);
    expect(ok({ ...base, date: "16/11/2026" }).date).toBe("2026-11-16");
  });
  it("categoria: regra local primeiro (iFood → Restaurantes), depois a sugestão da IA", () => {
    expect(ok({ ...base, merchant: "iFood", category: "Lazer", items: [] }).category).toBe("Restaurantes e delivery");
    expect(ok({ ...base, merchant: "Loja Qualquer", category: "Compras", items: [] }).category).toBe("Compras");
    expect(ok({ ...base, merchant: "Loja Qualquer", category: "Inventada", items: [] }).category).toBeNull();
  });
  it("valores como texto ('R$ 1.234,56') e cartão pelo final", () => {
    const r = ok({ ...base, total: "R$ 1.234,56", items: [], card_last4: "4321", payment: "credit" });
    expect(r.totalCents).toBe(123456);
    expect(r.cardLast4).toBe("4321");
  });
});

describe("dividir por categoria", () => {
  it("agrupa itens por categoria e a soma fecha com o total", () => {
    const parts = splitByCategory(ok(base))!;
    expect(parts.map((p) => [p.category, p.amountCents])).toEqual([["Mercado", 7490], ["Saúde", 1250]]);
    expect(parts.reduce((s, p) => s + (p.amountCents ?? 0), 0)).toBe(8740);
  });
  it("não oferece quando só há uma categoria ou a soma não fecha", () => {
    expect(splitByCategory(ok({ ...base, items: base.items.filter((i) => i.category === "Mercado"), total: 74.9 }))).toBeNull();
    expect(splitByCategory(ok({ ...base, total: 80 }))).toBeNull();
  });
});
