import { describe, expect, it } from "vitest";
import {
  categoryCutScenario,
  contributionsByMember,
  distribute,
  estimate,
  idealSeries,
  monthsToReach,
  monthsUntil,
  progress,
  projectedSeries,
  realizedSeries,
  requiredMonthly,
  savingsCapacity,
  simulate,
  weightedPace,
  type CapacityMonth,
} from "../math";

const today = "2026-11-17" as const;
// Meta "Carro" do seed: R$ 60.000 até nov/2028, R$ 11.000 guardados
const carro = { savedCents: 1_100_000, targetCents: 6_000_000, targetDate: "2028-11-30" as const, annualReturnBps: 0 };
const carroHistory = [
  { month: "2026-04-01" as const, cents: 150_000 },
  { month: "2026-06-01" as const, cents: 250_000 },
  { month: "2026-07-01" as const, cents: 80_000 },
  { month: "2026-08-01" as const, cents: 300_000 },
  { month: "2026-09-01" as const, cents: 120_000 },
  { month: "2026-10-01" as const, cents: 200_000 },
];

describe("progresso", () => {
  it("quanto falta e %", () => {
    expect(progress(1_100_000, 6_000_000)).toEqual({ remainingCents: 4_900_000, pct: 1_100_000 / 6_000_000, exceededCents: 0, done: false });
  });
  it("meta sem nenhum aporte", () => {
    expect(progress(0, 100_000)).toMatchObject({ remainingCents: 100_000, pct: 0, done: false });
  });
  it("aporte maior que o restante: 100% e excedente", () => {
    expect(progress(120_000, 100_000)).toEqual({ remainingCents: 0, pct: 1, exceededCents: 20_000, done: true });
  });
});

describe("valor mensal necessário", () => {
  it("Carro: R$ 49.000 em 24 meses = R$ 2.041,67/mês (arredonda para cima)", () => {
    expect(monthsUntil(today, "2028-11-30")).toBe(24);
    expect(requiredMonthly(carro, today)).toEqual({ kind: "monthly", monthlyCents: 204_167, months: 24 });
  });
  it("recalculado após aportes de R$ 300 e R$ 1.000: o mensal cai", () => {
    expect(requiredMonthly({ ...carro, savedCents: 1_130_000 }, today).monthlyCents).toBe(202_917);
    expect(requiredMonthly({ ...carro, savedCents: 1_230_000 }, today).monthlyCents).toBe(198_750);
  });
  it("se atrasei (um mês a menos), o mensal sobe", () => {
    expect(requiredMonthly(carro, "2026-12-01").monthlyCents).toBe(Math.ceil(4_900_000 / 23));
  });
  it("prazo no mês atual = tudo agora; prazo no passado = vencida", () => {
    expect(requiredMonthly({ ...carro, targetDate: "2026-11-30" }, today)).toEqual({ kind: "this_month", monthlyCents: 4_900_000, months: 0 });
    expect(requiredMonthly({ ...carro, targetDate: "2026-01-31" }, today)).toMatchObject({ kind: "overdue", monthlyCents: 4_900_000 });
  });
  it("sem prazo e concluída", () => {
    expect(requiredMonthly({ ...carro, targetDate: null }, today)).toEqual({ kind: "no_deadline", monthlyCents: null });
    expect(requiredMonthly({ ...carro, savedCents: 6_000_000 }, today)).toEqual({ kind: "done", monthlyCents: 0 });
  });
  it("com rendimento o mensal necessário é menor", () => {
    const r = requiredMonthly({ ...carro, annualReturnBps: 1000 }, today);
    expect(r.monthlyCents).toBeLessThan(204_167);
    expect(r.monthlyCents).toBeGreaterThan(170_000);
  });
});

describe("ritmo ponderado e estimativa", () => {
  it("média ponderada dos 6 meses fechados (pesos 1…6; mês sem aporte = 0)", () => {
    // mai 0·1 + jun 2500·2 + jul 800·3 + ago 3000·4 + set 1200·5 + out 2000·6 = 37400 ÷ 21
    expect(weightedPace(carroHistory, today, "2026-04-01")).toBe(178_095);
  });
  it("meta nova (2 meses) usa só os meses desde o início", () => {
    expect(weightedPace([{ month: "2026-10-01", cents: 30_000 }], today, "2026-09-15")).toBe(20_000); // (0·1 + 300·2) ÷ 3
  });
  it("criada neste mês: usa o mês atual; sem aporte nenhum: sem ritmo", () => {
    expect(weightedPace([{ month: "2026-11-01", cents: 50_000 }], today, "2026-11-02")).toBe(50_000);
    expect(weightedPace([], today, "2026-11-02")).toBeNull();
  });
  it("Carro pelo ritmo: 28 meses → março/2029, atrasada 4 meses", () => {
    const e = estimate(carro, { historyMonthlyCents: 178_095 }, today);
    expect(e).toMatchObject({ basis: "history", months: 28, date: "2029-03-31", status: "behind", deltaMonths: 4 });
  });
  it("aporte planejado tem prioridade sobre o histórico", () => {
    const e = estimate(carro, { planMonthlyCents: 250_000, historyMonthlyCents: 178_095 }, today);
    expect(e).toMatchObject({ basis: "plan", months: 20, status: "ahead", deltaMonths: -4 });
  });
  it("no ritmo, sem prazo, sem ritmo e concluída", () => {
    expect(estimate(carro, { planMonthlyCents: 204_167 }, today).status).toBe("on_track");
    expect(estimate({ ...carro, targetDate: null }, { historyMonthlyCents: 100_000 }, today).status).toBe("no_deadline");
    expect(estimate(carro, {}, today)).toMatchObject({ status: "no_pace", date: null });
    expect(estimate({ ...carro, savedCents: 7_000_000 }, {}, today).status).toBe("done");
  });
  it("prazo no passado e não concluída = atrasada", () => {
    expect(estimate({ ...carro, targetDate: "2026-06-30" }, { historyMonthlyCents: 100_000 }, today).status).toBe("behind");
  });
  it("monthsToReach: sem ritmo nunca chega; com juros chega antes", () => {
    expect(monthsToReach(0, 100_000, 0)).toBeNull();
    expect(monthsToReach(100_000, 100_000, 0)).toBe(0);
    expect(monthsToReach(0, 1_200_000, 100_000)).toBe(12);
    expect(monthsToReach(0, 2_400_000, 100_000)).toBe(24);
    expect(monthsToReach(0, 2_400_000, 100_000, 1200)).toBe(22); // 12% a.a.
  });
});

describe("capacidade de poupança", () => {
  const row = (month: string, o: Partial<CapacityMonth> = {}): CapacityMonth => ({
    month: month as CapacityMonth["month"], isProjection: false, incomeFixedCents: 0, incomeVariableCents: 0,
    expenseFixedCents: 0, expenseVariableCents: 0, savedCents: 0, ...o,
  });
  it("renda fixa projetada + média eventual − fixas projetadas − média variável", () => {
    const c = savingsCapacity([
      row("2026-08-01"),
      row("2026-09-01", { incomeFixedCents: 1_000_000, incomeVariableCents: 200_000, expenseFixedCents: 400_000, expenseVariableCents: 300_000 }),
      row("2026-10-01", { incomeFixedCents: 1_000_000, incomeVariableCents: 0, expenseFixedCents: 400_000, expenseVariableCents: 500_000 }),
      row("2026-12-01", { isProjection: true, incomeFixedCents: 1_100_000, expenseFixedCents: 450_000 }),
    ], 50_000);
    expect(c).toMatchObject({
      months: 2, // agosto vazio não dilui
      incomeCents: 1_100_000 + 100_000,
      fixedExpenseCents: 450_000,
      variableExpenseCents: 400_000,
      surplusCents: 350_000,
      committedCents: 50_000,
      freeCents: 300_000,
    });
  });
  it("sobra negativa é mostrada como negativa", () => {
    const c = savingsCapacity([
      row("2026-10-01", { incomeFixedCents: 100_000, expenseVariableCents: 300_000 }),
      row("2026-12-01", { isProjection: true, incomeFixedCents: 100_000 }),
    ], 0);
    expect(c.surplusCents).toBe(-200_000);
  });
});

describe("distribuição entre metas", () => {
  const goals = [
    { id: "a", name: "Carro", priority: 1 as const, remainingCents: 4_900_000, requiredMonthlyCents: 204_167, targetDate: "2028-11-30" as const },
    { id: "b", name: "Viagem", priority: 2 as const, remainingCents: 600_000, requiredMonthlyCents: 75_000, targetDate: "2027-07-31" as const },
    { id: "c", name: "Reserva", priority: 1 as const, remainingCents: 1_980_000, requiredMonthlyCents: null, targetDate: null },
    { id: "d", name: "Curso", priority: 3 as const, remainingCents: 10_000, requiredMonthlyCents: null, targetDate: null },
  ];
  it("inviável: precisa de R$ 2.791,67 e a sobra é R$ 1.900", () => {
    const d = distribute(190_000, goals);
    expect(d).toMatchObject({ requiredTotalCents: 279_167, feasible: false, shortfallCents: 89_167, unallocatedCents: 0 });
    expect(d.allocations.find((a) => a.id === "a")).toMatchObject({ cents: 190_000, covered: false });
    expect(d.allocations.find((a) => a.id === "b")).toMatchObject({ cents: 0, covered: false });
  });
  it("viável: cobre os prazos e divide o resto por prioridade, sem passar do que falta", () => {
    const d = distribute(400_000, goals);
    expect(d.feasible).toBe(true);
    const by = Object.fromEntries(d.allocations.map((a) => [a.id, a.cents]));
    expect(by.a).toBe(204_167);
    expect(by.b).toBe(75_000);
    expect(by.d).toBe(10_000); // cheia: o excedente volta para a Reserva
    expect(by.c).toBe(400_000 - 204_167 - 75_000 - 10_000);
    expect(d.unallocatedCents).toBe(0);
  });
  it("sobra negativa: nada a distribuir", () => {
    expect(distribute(-50_000, goals)).toMatchObject({ feasible: false, unallocatedCents: 0, shortfallCents: 279_167 });
  });
});

describe("séries, simulador e cenários", () => {
  it("realizado acumulado mês a mês desde o início", () => {
    const s = realizedSeries(0, carroHistory, "2026-04-01", today);
    expect(s[0]).toEqual({ month: "2026-04-01", cents: 150_000 });
    expect(s.at(-1)).toEqual({ month: "2026-11-01", cents: 1_100_000 });
  });
  it("projetado para quando atinge o alvo", () => {
    const s = projectedSeries(1_100_000, 6_000_000, 178_095, 0, today);
    expect(s).toHaveLength(29);
    expect(s.at(-1)!.cents).toBeGreaterThanOrEqual(6_000_000);
  });
  it("linha ideal: reta até o prazo", () => {
    const s = idealSeries(0, 2_400_000, "2026-11-01", "2028-11-30");
    expect(s).toHaveLength(25);
    expect(s[12].cents).toBe(1_200_000);
  });
  it("simulador: aporte de R$ 2.500/mês antecipa", () => {
    const sim = simulate(carro, { monthlyCents: 250_000 }, today);
    expect(sim.estimate).toMatchObject({ months: 20, status: "ahead" });
    expect(simulate(carro, { targetDate: "2027-11-30" }, today).required.monthlyCents).toBe(Math.ceil(4_900_000 / 12));
    expect(simulate(carro, { targetCents: 4_000_000 }, today).required.monthlyCents).toBe(Math.ceil(2_900_000 / 24));
  });
  it("cortar 30% de R$ 600/mês em Restaurantes antecipa o Carro", () => {
    const c = categoryCutScenario(carro, 178_095, 60_000, 0.3);
    expect(c).toEqual({ extraMonthlyCents: 18_000, monthsBefore: 28, monthsAfter: 25, monthsSaved: 3 });
  });
  it("contribuição por membro", () => {
    expect(contributionsByMember([{ memberId: "ana", cents: 300 }, { memberId: "caio", cents: 100 }, { memberId: "ana", cents: -100 }]))
      .toEqual([{ memberId: "ana", cents: 200, share: 2 / 3 }, { memberId: "caio", cents: 100, share: 1 / 3 }]);
  });
});
