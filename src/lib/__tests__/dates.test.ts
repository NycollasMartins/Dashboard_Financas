import { describe, expect, it } from "vitest";
import { addMonths, clampedDate, formatMonth, monthStart, todayISO } from "@/lib/dates";

describe("datas (America/Sao_Paulo)", () => {
  it("todayISO usa o fuso de São Paulo, não UTC", () => {
    // 02:30 UTC de 18/11 ainda é 17/11 (23:30) em São Paulo (UTC-3).
    expect(todayISO(new Date("2026-11-18T02:30:00Z"))).toBe("2026-11-17");
    expect(todayISO(new Date("2026-11-18T03:30:00Z"))).toBe("2026-11-18");
  });

  it("monthStart", () => {
    expect(monthStart("2026-11-17")).toBe("2026-11-01");
  });

  it("clampedDate prende ao último dia do mês", () => {
    expect(clampedDate(2026, 2, 31)).toBe("2026-02-28");
    expect(clampedDate(2028, 2, 30)).toBe("2028-02-29");
    expect(clampedDate(2026, 4, 31)).toBe("2026-04-30");
    expect(clampedDate(2026, 1, 5)).toBe("2026-01-05");
  });

  it("addMonths atravessa anos", () => {
    expect(addMonths("2026-11-01", 2)).toBe("2027-01-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
    expect(addMonths("2026-06-01", 24)).toBe("2028-06-01");
  });

  it("formatMonth em pt-BR", () => {
    expect(formatMonth("2026-11-01")).toBe("novembro de 2026");
  });
});

describe("fuso de São Paulo perto da meia-noite", () => {
  it("23:59 de 31/12 em SP ainda é o ano velho", () => {
    expect(todayISO(new Date("2027-01-01T02:59:00Z"))).toBe("2026-12-31");
    expect(todayISO(new Date("2027-01-01T03:00:00Z"))).toBe("2027-01-01");
  });
});
