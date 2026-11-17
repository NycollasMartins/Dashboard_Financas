import { describe, expect, it } from "vitest";
import { monthlyEquivalent, projectedDates } from "../projection";

const today = "2026-11-17" as const;
const aluguel = { frequency: "monthly" as const, dayOfMonth: 10, startsOn: "2026-11-01" as const, isActive: true, lastGeneratedOn: "2026-11-30" as const };

describe("motor de projeção (espelho de private.projected_occurrences)", () => {
  it("mês atual já gerado → nenhuma ocorrência virtual", () => {
    expect(projectedDates(aluguel, "2026-11-01", "2026-11-30", today)).toEqual([]);
  });
  it("meses futuros vêm da regra, sem gravar nada", () => {
    expect(projectedDates(aluguel, "2026-12-01", "2027-02-28", today)).toEqual(["2026-12-10", "2027-01-10", "2027-02-10"]);
  });
  it("cobre 36 meses à frente e para antes do 37º (mesmo limite do SQL)", () => {
    expect(projectedDates(aluguel, "2026-12-01", "2029-11-30", today)).toHaveLength(36);
    expect(projectedDates(aluguel, "2026-12-01", "2035-01-01", today).at(-1)).toBe("2029-11-10");
  });
  it("respeita fim, pausa e dia 31", () => {
    expect(projectedDates({ ...aluguel, endsOn: "2027-01-15" }, "2026-12-01", "2027-06-30", today)).toEqual(["2026-12-10", "2027-01-10"]);
    expect(projectedDates({ ...aluguel, isActive: false }, "2026-12-01", "2027-06-30", today)).toEqual([]);
    expect(projectedDates({ ...aluguel, dayOfMonth: 31 }, "2027-02-01", "2027-02-28", today)).toEqual(["2027-02-28"]);
  });
  it("valor mensal equivalente", () => {
    expect(monthlyEquivalent(10_000, "weekly")).toBe(43_333);
    expect(monthlyEquivalent(120_000, "yearly")).toBe(10_000);
    expect(monthlyEquivalent(50_000, "monthly")).toBe(50_000);
  });
});
