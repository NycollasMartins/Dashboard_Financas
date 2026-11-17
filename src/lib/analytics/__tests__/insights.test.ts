import { describe, expect, it } from "vitest";
import type { CategoryNode } from "../categories";
import { buildInsights, type InsightInput } from "../insights";

const cat = (over: Partial<CategoryNode>): CategoryNode => ({
  id: "c", name: "Delivery", color: "#000", icon: "x", totalCents: 0, plannedCents: 0, share: 0,
  previousCents: 0, averageCents: 0, children: [], ...over,
});

const base: InsightInput = {
  isCurrentPeriod: true,
  incomeCents: 0,
  expenseCents: 0,
  incomePlannedCents: 0,
  expensePlannedCents: 0,
  projectedBalanceCents: 0,
  categories: [],
  overdueCount: 0,
  overdueCents: 0,
  cardUsage: null,
};
const ids = (i: InsightInput, limit?: number) => buildInsights(i, limit).map((x) => x.id);

describe("buildInsights", () => {
  it("sem dados → nenhum insight", () => {
    expect(buildInsights(base)).toEqual([]);
  });

  it("categoria acima da média (≥ 20% e ≥ R$ 50)", () => {
    const [i] = buildInsights({ ...base, categories: [cat({ id: "d", totalCents: 66000, averageCents: 50000 })], ledgerHref: (id) => `/l?c=${id}` });
    expect(i.text).toBe("Você gastou 32% a mais em Delivery que a média dos últimos 3 meses (R$ 160,00 acima).");
    expect(i.privateText).toBe("Você gastou 32% a mais em Delivery que a média dos últimos 3 meses.");
    expect(i.href).toBe("/l?c=d");
  });

  it("ignora variação pequena em valor ou em percentual", () => {
    expect(ids({ ...base, categories: [cat({ totalCents: 6000, averageCents: 2000 })] })).toEqual([]);
    expect(ids({ ...base, categories: [cat({ totalCents: 110000, averageCents: 100000 })] })).toEqual([]);
  });

  it("receitas previstas faltando, só no período atual", () => {
    const [i] = buildInsights({ ...base, incomePlannedCents: 480000 });
    expect(i.text).toBe("Faltam R$ 4.800,00 de receitas previstas este mês.");
    expect(i.privateText).not.toContain("4.800");
    expect(ids({ ...base, isCurrentPeriod: false, incomePlannedCents: 480000 })).toEqual([]);
  });

  it("alertas vêm antes e o limite corta o resto", () => {
    const r = ids({
      ...base,
      overdueCount: 2,
      overdueCents: 30000,
      projectedBalanceCents: -1000,
      cardUsage: 0.9,
      incomePlannedCents: 100,
      incomeCents: 100000,
      expenseCents: 50000,
    }, 3);
    expect(r).toEqual(["overdue", "projected-negative", "card-limit"]);
  });

  it("taxa de economia boa e despesas maiores que receitas", () => {
    expect(ids({ ...base, incomeCents: 100000, expenseCents: 70000 })).toEqual(["savings-good"]);
    expect(ids({ ...base, incomeCents: 100000, expenseCents: 120000 })).toEqual(["savings-negative"]);
  });

  it("queda em relação à média só em período fechado", () => {
    const c = [cat({ id: "l", name: "Lazer", totalCents: 20000, averageCents: 40000 })];
    expect(ids({ ...base, categories: c })).toEqual([]);
    expect(buildInsights({ ...base, isCurrentPeriod: false, categories: c })[0].text).toBe(
      "Boa! Lazer ficou 50% abaixo da média dos últimos 3 meses.",
    );
  });
});
