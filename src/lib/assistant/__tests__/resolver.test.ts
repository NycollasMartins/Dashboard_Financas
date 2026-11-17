import { describe, expect, it } from "vitest";
import { applyAnswer, resolveItem, type Lookups } from "../resolver";
import { emptyItem, type ParsedItem } from "../types";

const lk: Lookups = {
  workspaceId: "ws",
  categories: [
    { id: "c-merc", name: "Mercado", kind: "expense" },
    { id: "c-transp", name: "Transporte", kind: "expense" },
    { id: "c-freela", name: "Freelance", kind: "income" },
  ],
  accounts: [{ id: "a-nu", name: "Conta Nubank" }, { id: "a-poup", name: "Poupança" }, { id: "a-cart", name: "Carteira" }],
  cards: [{ id: "k-nu", name: "Nubank" }, { id: "k-inter", name: "Inter" }],
  goals: [
    { id: "g-carro", name: "Carro", status: "active", reserveAccountId: "a-poup", planAccountId: null },
    { id: "g-viagem", name: "Viagem", status: "active", reserveAccountId: null, planAccountId: "a-nu" },
  ],
  defaultAccountId: "a-nu",
};
const today = "2026-11-17" as const;
const item = (o: Partial<ParsedItem>): ParsedItem => ({ ...emptyItem("registrar_despesa"), ...o });

describe("resolvedor", () => {
  it("despesa simples → ação pronta com conta padrão e categoria", () => {
    const r = resolveItem(item({ amountCents: 5000, category: "Transporte" }), lk, today);
    expect(r).toMatchObject({ status: "ready", action: { kind: "expense", amountCents: 5000, categoryId: "c-transp", paymentMethod: "pix", accountId: "a-nu", occurredOn: today } });
  });
  it("sem valor → pergunta o valor", () => {
    expect(resolveItem(item({ category: "Mercado" }), lk, today)).toMatchObject({ status: "question", question: { field: "amount" } });
  });
  it("crédito sem cartão e com 2 cartões → pergunta qual (com opções)", () => {
    const r = resolveItem(item({ amountCents: 1000, payment: "credit" }), lk, today);
    expect(r).toMatchObject({ status: "question", question: { field: "card", options: [{ value: "k-nu" }, { value: "k-inter" }] } });
  });
  it("'no nubank' sem forma de pagamento e com cartão E conta Nubank → pergunta", () => {
    const r = resolveItem(item({ amountCents: 1000, card: "Nubank", account: "Conta Nubank" }), lk, today);
    expect(r).toMatchObject({ status: "question", question: { field: "payment_target" } });
    if (r.status !== "question") throw new Error();
    const answered = applyAnswer(r.item, "payment_target", "k-nu", lk);
    expect(resolveItem(answered, lk, today)).toMatchObject({ status: "ready", action: { paymentMethod: "credit", cardId: "k-nu" } });
  });
  it("só o cartão citado, mas existe uma conta com o mesmo nome → pergunta", () => {
    expect(resolveItem(item({ amountCents: 6000, card: "Nubank" }), lk, today)).toMatchObject({ status: "question", question: { field: "payment_target" } });
    expect(resolveItem(item({ amountCents: 6000, card: "Inter" }), lk, today)).toMatchObject({ status: "ready", action: { cardId: "k-inter" } });
  });
  it("parcelada → crédito no cartão citado", () => {
    const r = resolveItem(item({ intent: "registrar_compra_parcelada", amountCents: 300000, installments: 10, card: "Nubank" }), lk, today);
    expect(r).toMatchObject({ status: "ready", action: { paymentMethod: "credit", cardId: "k-nu", installments: 10 } });
  });
  it("receita no crédito vira pix", () => {
    const r = resolveItem(item({ intent: "registrar_receita", amountCents: 100000, payment: "credit", category: "Freelance" }), lk, today);
    expect(r).toMatchObject({ status: "ready", action: { kind: "income", paymentMethod: "pix", categoryId: "c-freela" } });
  });
  it("transferência: pergunta a conta que faltar; mesma conta é erro", () => {
    expect(resolveItem(item({ intent: "transferir", amountCents: 100, account: "Conta Nubank" }), lk, today)).toMatchObject({ status: "question", question: { field: "to" } });
    expect(resolveItem(item({ intent: "transferir", amountCents: 100, account: "Poupança", toAccount: "Poupança" }), lk, today)).toMatchObject({ status: "error" });
  });
  it("guardar: meta pelo nome; conta do plano; reserva não é origem", () => {
    expect(resolveItem(item({ intent: "guardar_em_meta", amountCents: 30000, goal: "Viagem" }), lk, today))
      .toMatchObject({ status: "ready", action: { type: "goal", kind: "deposit", goalId: "g-viagem", accountId: "a-nu" } });
    expect(resolveItem(item({ intent: "guardar_em_meta", amountCents: 30000 }), lk, today)).toMatchObject({ status: "question", question: { field: "goal" } });
  });
  it("retirada sem motivo → pergunta o motivo", () => {
    const r = resolveItem(item({ intent: "retirar_de_meta", amountCents: 20000, goal: "Carro" }), lk, today);
    expect(r).toMatchObject({ status: "question", question: { field: "note" } });
  });
});
