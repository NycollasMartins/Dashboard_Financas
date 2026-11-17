import { formatBRL } from "@/lib/money";
import type { CategoryNode } from "./categories";
import { formatPct } from "./delta";

/*
 * Insights em texto calculados por REGRAS (sem IA) — RN-66.
 * Cada regra é pura e testada; a tela mostra no máximo `limit`, priorizando
 * alertas. Textos curtos, em segunda pessoa, dizendo o que aconteceu.
 */

export type InsightTone = "good" | "warning" | "bad" | "info";
export type Insight = {
  id: string;
  tone: InsightTone;
  text: string;
  /** Texto com valores mascarados (modo "ocultar valores"). */
  privateText: string;
  href?: string;
};

export type InsightInput = {
  isCurrentPeriod: boolean;
  incomeCents: number;
  expenseCents: number;
  incomePlannedCents: number;
  expensePlannedCents: number;
  projectedBalanceCents: number | null;
  categories: readonly CategoryNode[];
  overdueCount: number;
  overdueCents: number;
  /** Uso do limite dos cartões (0–1), null sem limite cadastrado. */
  cardUsage: number | null;
  /** Para montar o link da lista de lançamentos filtrada. */
  ledgerHref?: (categoryId: string) => string;
};

/** Variação mínima para chamar atenção: 20% e R$ 50. */
const MIN_PCT = 0.2;
const MIN_DIFF_CENTS = 5000;
const HIDDEN = "R$ •••";

const money = (c: number) => formatBRL(c);

export function buildInsights(input: InsightInput, limit = 4): Insight[] {
  const out: (Insight & { weight: number })[] = [];
  const push = (weight: number, i: Omit<Insight, "privateText"> & { privateText?: string }) =>
    out.push({ ...i, privateText: i.privateText ?? i.text, weight });

  if (input.overdueCount > 0) {
    const n = input.overdueCount;
    push(100, {
      id: "overdue",
      tone: "bad",
      text: `Você tem ${n} ${n === 1 ? "conta vencida" : "contas vencidas"} somando ${money(input.overdueCents)}.`,
      privateText: `Você tem ${n} ${n === 1 ? "conta vencida" : "contas vencidas"}.`,
    });
  }

  if (input.isCurrentPeriod && input.projectedBalanceCents !== null && input.projectedBalanceCents < 0) {
    push(90, {
      id: "projected-negative",
      tone: "bad",
      text: `Pelo previsto, suas contas terminam o mês no negativo (${money(input.projectedBalanceCents)}).`,
      privateText: "Pelo previsto, suas contas terminam o mês no negativo.",
    });
  }

  if (input.cardUsage !== null && input.cardUsage >= 0.8) {
    push(70, {
      id: "card-limit",
      tone: "warning",
      text: `Você já usa ${formatPct(input.cardUsage, { signed: false })} do limite dos cartões.`,
    });
  }

  // Categorias acima/abaixo da média dos últimos 3 meses
  const withAvg = input.categories.filter((c) => c.averageCents > 0 && c.id !== null);
  const ups = withAvg
    .map((c) => ({ c, diff: c.totalCents - c.averageCents, pct: (c.totalCents - c.averageCents) / c.averageCents }))
    .filter((x) => x.pct >= MIN_PCT && x.diff >= MIN_DIFF_CENTS)
    .sort((a, b) => b.diff - a.diff);
  for (const [i, x] of ups.slice(0, 2).entries()) {
    push(60 - i, {
      id: `cat-up-${x.c.id}`,
      tone: "warning",
      text: `Você gastou ${formatPct(x.pct, { signed: false })} a mais em ${x.c.name} que a média dos últimos 3 meses (${money(x.diff)} acima).`,
      privateText: `Você gastou ${formatPct(x.pct, { signed: false })} a mais em ${x.c.name} que a média dos últimos 3 meses.`,
      href: x.c.id && input.ledgerHref ? input.ledgerHref(x.c.id) : undefined,
    });
  }
  const downs = withAvg
    .map((c) => ({ c, diff: c.averageCents - c.totalCents, pct: (c.averageCents - c.totalCents) / c.averageCents }))
    .filter((x) => x.pct >= MIN_PCT && x.diff >= MIN_DIFF_CENTS && !input.isCurrentPeriod)
    .sort((a, b) => b.diff - a.diff);
  if (downs[0]) {
    const x = downs[0];
    push(30, {
      id: `cat-down-${x.c.id}`,
      tone: "good",
      text: `Boa! ${x.c.name} ficou ${formatPct(x.pct, { signed: false })} abaixo da média dos últimos 3 meses.`,
    });
  }

  if (input.isCurrentPeriod && input.incomePlannedCents > 0) {
    push(50, {
      id: "income-pending",
      tone: "info",
      text: `Faltam ${money(input.incomePlannedCents)} de receitas previstas este mês.`,
      privateText: "Ainda há receitas previstas para entrar este mês.",
    });
  }
  if (input.isCurrentPeriod && input.expensePlannedCents > 0) {
    push(40, {
      id: "expense-pending",
      tone: "info",
      text: `Ainda há ${money(input.expensePlannedCents)} em despesas previstas até o fim do mês.`,
      privateText: "Ainda há despesas previstas até o fim do mês.",
    });
  }

  if (input.incomeCents > 0) {
    const rate = (input.incomeCents - input.expenseCents) / input.incomeCents;
    if (rate >= 0.2) {
      push(20, {
        id: "savings-good",
        tone: "good",
        text: `Você está guardando ${formatPct(rate, { signed: false })} da renda${input.isCurrentPeriod ? " até agora" : ""}.`,
      });
    } else if (rate < 0) {
      push(80, {
        id: "savings-negative",
        tone: "bad",
        text: `As despesas passaram as receitas em ${money(input.expenseCents - input.incomeCents)}.`,
        privateText: "As despesas passaram as receitas neste período.",
      });
    }
  }

  return out
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map((i): Insight => ({ id: i.id, tone: i.tone, text: i.text, privateText: i.privateText, href: i.href }))
    .map((i) => (i.privateText.includes("R$") ? { ...i, privateText: i.privateText.replace(/-?R\$\s?[\d.,]+/g, HIDDEN) } : i));
}
