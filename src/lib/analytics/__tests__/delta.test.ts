import { describe, expect, it } from "vitest";
import { formatPct, savingsRate, toneFor, variation } from "../delta";

describe("variation", () => {
  it("calcula percentual e direção", () => {
    expect(variation(13200, 10000)).toEqual({ direction: "up", pct: 0.32, diff: 3200 });
    expect(variation(8000, 10000)).toEqual({ direction: "down", pct: -0.2, diff: -2000 });
  });
  it("anterior zero → sem percentual", () => {
    expect(variation(5000, 0)).toEqual({ direction: "up", pct: null, diff: 5000 });
    expect(variation(0, 0)).toEqual({ direction: "flat", pct: null, diff: 0 });
  });
  it("variação mínima conta como estável", () => {
    expect(variation(100_040, 100_000).direction).toBe("flat");
  });
  it("saldo negativo usa o módulo do anterior", () => {
    expect(variation(-5000, -10000)).toMatchObject({ direction: "up", pct: 0.5 });
  });
});

describe("toneFor", () => {
  it("gasto subindo é ruim; receita subindo é boa", () => {
    expect(toneFor("expense", "up")).toBe("bad");
    expect(toneFor("expense", "down")).toBe("good");
    expect(toneFor("income", "up")).toBe("good");
    expect(toneFor("income", "down")).toBe("bad");
    expect(toneFor("balance", "up")).toBe("good");
    expect(toneFor("rate", "down")).toBe("bad");
    expect(toneFor("expense", "flat")).toBe("neutral");
  });
});

describe("formatPct e savingsRate", () => {
  it("formata com sinal", () => {
    expect(formatPct(0.32)).toBe("+32%");
    expect(formatPct(-0.084)).toBe("−8%");
    expect(formatPct(null)).toBe("novo");
    expect(formatPct(0.32, { signed: false })).toBe("32%");
  });
  it("taxa de economia", () => {
    expect(savingsRate(1000000, 750000)).toBe(0.25);
    expect(savingsRate(0, 5000)).toBeNull();
    expect(savingsRate(1000, 1500)).toBe(-0.5);
  });
});
