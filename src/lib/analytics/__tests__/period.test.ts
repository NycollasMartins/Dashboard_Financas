import { describe, expect, it } from "vitest";
import { addDays, endOfMonth, isCurrent, resolvePeriod } from "../period";

const today = "2026-11-17" as const;

describe("resolvePeriod", () => {
  it("padrão = mês atual, com anterior, média de 3 meses e 12 meses de tendência", () => {
    const p = resolvePeriod({}, today);
    expect(p).toMatchObject({
      kind: "month",
      from: "2026-11-01",
      to: "2026-11-30",
      label: "Novembro de 2026",
      previous: { from: "2026-10-01", to: "2026-10-31" },
      average: { from: "2026-08-01", to: "2026-10-31" },
      trend: { from: "2025-12-01", to: "2026-11-30" },
      months: 1,
    });
  });

  it("mês escolhido em janeiro: anterior e média atravessam o ano", () => {
    const p = resolvePeriod({ periodo: "2026-01" }, today);
    expect(p.previous).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(p.average).toEqual({ from: "2025-10-01", to: "2025-12-31" });
  });

  it("fevereiro bissexto termina no dia 29", () => {
    expect(resolvePeriod({ periodo: "2028-02" }, today).to).toBe("2028-02-29");
  });

  it("ano inteiro compara com o ano anterior", () => {
    const p = resolvePeriod({ ano: "2026" }, today);
    expect(p).toMatchObject({ kind: "year", from: "2026-01-01", to: "2026-12-31", label: "2026", months: 12 });
    expect(p.previous).toEqual({ from: "2025-01-01", to: "2025-12-31" });
    expect(p.trend).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });

  it("intervalo personalizado compara com o intervalo imediatamente anterior de mesmo tamanho", () => {
    const p = resolvePeriod({ de: "2026-03-10", ate: "2026-03-19" }, today);
    expect(p).toMatchObject({ kind: "range", label: "10/03/2026 – 19/03/2026", months: 1 });
    expect(p.previous).toEqual({ from: "2026-02-28", to: "2026-03-09" });
  });

  it("intervalo tem prioridade sobre ano e mês", () => {
    expect(resolvePeriod({ de: "2026-01-01", ate: "2026-02-15", ano: "2025", periodo: "2024-01" }, today).kind).toBe("range");
  });

  it.each([
    [{ periodo: "2026-13" }],
    [{ periodo: "abc" }],
    [{ ano: "99" }],
    [{ de: "2026-03-10", ate: "2026-03-01" }],
    [{ de: "2026-02-30", ate: "2026-03-01" }],
    [{ de: "2020-01-01", ate: "2026-01-01" }],
  ])("parâmetros inválidos voltam ao mês atual: %j", (params) => {
    expect(resolvePeriod(params, today)).toMatchObject({ kind: "month", from: "2026-11-01" });
  });
});

describe("helpers", () => {
  it("endOfMonth e addDays", () => {
    expect(endOfMonth("2026-02-01")).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("isCurrent", () => {
    expect(isCurrent({ from: "2026-11-01", to: "2026-11-30" }, today)).toBe(true);
    expect(isCurrent({ from: "2026-10-01", to: "2026-10-31" }, today)).toBe(false);
  });
});
