/*
 * Variação entre períodos e sua cor semântica (RN-63).
 * Gasto subindo é ruim; receita, saldo e taxa de economia subindo são bons.
 */

export type Direction = "up" | "down" | "flat";
export type Tone = "good" | "bad" | "neutral";
export type MetricKind = "income" | "expense" | "balance" | "rate";

export type Variation = {
  direction: Direction;
  /** Variação percentual (0.32 = +32%). null quando o anterior é zero. */
  pct: number | null;
  /** Diferença absoluta (centavos ou pontos percentuais, conforme a métrica). */
  diff: number;
};

/** Variações menores que 0,5% contam como "estável". */
const FLAT_THRESHOLD = 0.005;

export function variation(current: number, previous: number): Variation {
  const diff = current - previous;
  if (previous === 0) {
    return { direction: diff === 0 ? "flat" : diff > 0 ? "up" : "down", pct: null, diff };
  }
  const pct = diff / Math.abs(previous);
  if (Math.abs(pct) < FLAT_THRESHOLD) return { direction: "flat", pct: 0, diff };
  return { direction: pct > 0 ? "up" : "down", pct, diff };
}

export function toneFor(metric: MetricKind, direction: Direction): Tone {
  if (direction === "flat") return "neutral";
  const upIsGood = metric !== "expense";
  return (direction === "up") === upIsGood ? "good" : "bad";
}

/** "+32%", "−8%", "0%"; null → "novo". */
export function formatPct(pct: number | null, { signed = true } = {}): string {
  if (pct === null) return "novo";
  const v = Math.round(Math.abs(pct) * 100);
  const sign = !signed || v === 0 ? "" : pct > 0 ? "+" : "−";
  return `${sign}${v.toLocaleString("pt-BR")}%`;
}

/** Taxa de economia = (receitas − despesas) / receitas. null sem receitas. */
export function savingsRate(incomeCents: number, expenseCents: number): number | null {
  if (incomeCents <= 0) return null;
  return (incomeCents - expenseCents) / incomeCents;
}
