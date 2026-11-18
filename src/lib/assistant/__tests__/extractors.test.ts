import { describe, expect, it } from "vitest";
import { findDate, findPeriod } from "../dates";
import { findAmounts, parseAmount } from "../money";
import { mentions, normalize } from "../normalize";

const cents = (t: string) => findAmounts(normalize(t)).map((a) => a.cents);
const today = "2026-11-17" as const; // terça-feira

describe("normalize", () => {
  it("minúsculas, sem acento, typos", () => {
    expect(normalize("Gatei R$ 50  no ÚBER")).toBe("gastei r$ 50 no uber");
    expect(normalize("comprei no I Food")).toBe("comprei no ifood");
  });
  it("menciona nomes com 1 erro de digitação", () => {
    expect(mentions("guardei 300 pra viajem", "Viagem")).toBe(true);
    expect(mentions("guardei 300 pra reserva", "Reserva de emergência")).toBe(true);
    expect(mentions("no inter", "Nubank")).toBe(false);
  });
});

describe("valores", () => {
  it.each([
    ["gastei 50 no uber", [5000]],
    ["R$ 50,90 mercado", [5090]],
    ["paguei 50.90", [5090]],
    ["1.234,56 de aluguel", [123456]],
    ["tv de 1.500", [150000]],
    ["50 conto de pizza", [5000]],
    ["30 pila no bar", [3000]],
    ["recebi 1k de freela", [100000]],
    ["1,5k de bonus", [150000]],
    ["2 mil de salario", [200000]],
    ["mil e duzentos de aluguel", [120000]],
    ["dois mil e quinhentos", [250000]],
    ["cinquenta reais de gasolina", [5000]],
    ["cento e vinte no mercado", [12000]],
    ["gastei 30 no uber e 80 no mercado", [3000, 8000]],
  ])("%s", (text, expected) => {
    expect(cents(text)).toEqual(expected);
  });
  it.each([
    ["comprei uma tv de 3000 em 10x", [300000]],
    ["paguei dia 5 o aluguel de 2800", [280000]],
    ["gastei 40 em 05/11", [4000]],
    ["comi um lanche de 25", [2500]],
    ["rendeu 10%", []],
  ])("ignora parcelas, dias, datas, artigos e %%: %s", (text, expected) => {
    expect(cents(text)).toEqual(expected);
  });
  it("parseAmount aceita número (reais) e texto da IA", () => {
    expect(parseAmount(12.5)).toBe(1250);
    expect(parseAmount("R$ 1.200,00")).toBe(120000);
    expect(parseAmount(-3)).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
});

describe("datas relativas (hoje = terça 17/11/2026)", () => {
  const d = (t: string) => findDate(normalize(t), today)?.date;
  it.each([
    ["gastei 50 hoje", "2026-11-17"],
    ["ontem paguei", "2026-11-16"],
    ["anteontem", "2026-11-15"],
    ["dia 5", "2026-11-05"],
    ["dia 20", "2026-10-20"],
    ["dia 3 de outubro", "2026-10-03"],
    ["em 05/11", "2026-11-05"],
    ["15/12", "2025-12-15"],
    ["10/01/2026", "2026-01-10"],
    ["na sexta", "2026-11-13"],
    ["sexta passada", "2026-11-13"],
    ["terca passada", "2026-11-10"],
    ["na terca", "2026-11-17"],
    ["sabado", "2026-11-14"],
  ])("%s → %s", (text, expected) => {
    expect(d(text)).toBe(expected);
  });
  it("sem data → null", () => {
    expect(d("gastei 50 no uber")).toBeUndefined();
  });
});

describe("períodos de consulta", () => {
  const p = (t: string) => findPeriod(normalize(t), today);
  it("padrão = este mês", () => expect(p("quanto gastei com mercado")).toMatchObject({ from: "2026-11-01", to: "2026-11-30" }));
  it("mês passado, semana passada, ano, mês nomeado", () => {
    expect(p("quanto gastei mes passado")).toMatchObject({ from: "2026-10-01", to: "2026-10-31", label: "em outubro" });
    expect(p("e semana passada?")).toMatchObject({ from: "2026-11-09", to: "2026-11-15" });
    expect(p("esse ano")).toMatchObject({ from: "2026-01-01", to: "2026-11-17" });
    expect(p("quanto gastei em dezembro")).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
  });
});

describe("fala transcrita (Fase 6)", () => {
  it("diminutivos e “32 e 50” = R$ 32,50 (mesmo com pontuação do transcritor)", async () => {
    const { findAmounts } = await import("../money");
    const cents = (t: string) => findAmounts(t).map((a) => a.cents);
    expect(cents("gastei cinquentinha no uber")).toEqual([5000]);
    expect(cents("um vintinho de lanche")).toEqual([2000]);
    expect(cents("almoco 32 e 50.")).toEqual([3250]);
    expect(cents("paguei 12 e 90 na farmacia")).toEqual([1290]);
    // não confunde com dois valores, parcelas ou decimais
    expect(cents("30 no uber e 80 no mercado")).toEqual([3000, 8000]);
    expect(cents("3000 e 10x")).toEqual([300000]);
    expect(cents("32 e 50,90")).toEqual([3200, 5090]);
  });
});
