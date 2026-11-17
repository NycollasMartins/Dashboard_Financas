import { describe, expect, it } from "vitest";
import { formatBRL, parseBRL, splitInstallments, sumCents } from "@/lib/money";

// O Intl usa espaço não separável (U+00A0) entre "R$" e o número.
const nb = (s: string) => s.replace(/ /g, " ");

describe("parseBRL", () => {
  it.each([
    ["50", 5000],
    ["50,9", 5090],
    ["50,90", 5090],
    ["0,01", 1],
    ["1.234,56", 123456],
    ["R$ 1.234,56", 123456],
    ["r$1234,5", 123450],
    ["1234.56", 123456],
    ["1.234", 123400],
    ["1.234.567,89", 123456789],
    ["-10", -1000],
    ["  100  ", 10000],
    ["10,", 1000],
  ])("%s → %i centavos", (input, expected) => {
    expect(parseBRL(input)).toBe(expected);
  });

  it.each(["", "abc", "1,2,3", "1,234", "12.34.56", "1.23,4", "--5", "1e5", "NaN"])(
    "rejeita %j",
    (input) => {
      expect(parseBRL(input)).toBeNull();
    },
  );

  it("nunca sofre erro de ponto flutuante", () => {
    // 0.1 + 0.2 em float = 0.30000000000000004
    expect(parseBRL("0,10")! + parseBRL("0,20")!).toBe(30);
    expect(parseBRL("19,99")).toBe(1999);
    expect(parseBRL("1.000.000,07")).toBe(100000007);
  });
});

describe("formatBRL", () => {
  it("formata centavos em reais", () => {
    expect(formatBRL(123456)).toBe(nb("R$ 1.234,56"));
    expect(formatBRL(5)).toBe(nb("R$ 0,05"));
    expect(formatBRL(-5000)).toBe(nb("-R$ 50,00"));
    expect(formatBRL(5000, { signed: true })).toBe(nb("+R$ 50,00"));
  });

  it("recusa valores não inteiros", () => {
    expect(() => formatBRL(10.5)).toThrow(TypeError);
  });
});

describe("splitInstallments", () => {
  it("distribui o resto na primeira parcela e preserva o total", () => {
    expect(splitInstallments(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(sumCents(splitInstallments(99999, 12))).toBe(99999);
    expect(splitInstallments(1200, 12)).toEqual(Array(12).fill(100));
  });

  it("rejeita número de parcelas inválido", () => {
    expect(() => splitInstallments(100, 0)).toThrow(RangeError);
  });
});
