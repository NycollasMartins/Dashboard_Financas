import { addMonths, daysInMonth, monthStart, type ISODate } from "@/lib/dates";

/*
 * Cálculos de metas (Fase 4) — PUROS, em centavos inteiros, datas em São Paulo.
 * Documentação das fórmulas: docs/requisitos.md (RN-78…RN-86) e ADR-0016.
 *
 * Convenção de calendário: os aportes acontecem uma vez por mês; o "mês 1" é o
 * PRÓXIMO mês. Prazo em novembro/2028 visto de novembro/2026 = 24 meses.
 * Prazo no mês atual = 0 meses (falta tudo agora); prazo no passado = vencido.
 */

export type Cents = number;

const ym = (d: ISODate) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1;
export const endOfMonth = (m: ISODate): ISODate => {
  const [y, mo] = m.split("-").map(Number);
  return `${y}-${String(mo).padStart(2, "0")}-${String(daysInMonth(y, mo)).padStart(2, "0")}` as ISODate;
};

/** Meses-calendário do mês de `today` até o mês de `target` (negativo = no passado). */
export function monthsUntil(today: ISODate, target: ISODate): number {
  return ym(target) - ym(today);
}

/** Taxa mensal equivalente a uma taxa anual em pontos-base: (1 + a)^(1/12) − 1. */
export function monthlyRate(annualBps: number): number {
  if (!annualBps) return 0;
  return Math.pow(1 + annualBps / 10_000, 1 / 12) - 1;
}

/** Valor futuro após n meses com aporte `monthly` no fim de cada mês (juros compostos). */
export function futureValue(saved: Cents, monthly: Cents, months: number, rate: number): number {
  if (rate === 0) return saved + monthly * months;
  const g = Math.pow(1 + rate, months);
  return saved * g + (monthly * (g - 1)) / rate;
}

export type Progress = { remainingCents: Cents; pct: number; exceededCents: Cents; done: boolean };

export function progress(savedCents: Cents, targetCents: Cents): Progress {
  return {
    remainingCents: Math.max(0, targetCents - savedCents),
    pct: targetCents > 0 ? Math.max(0, Math.min(1, savedCents / targetCents)) : 0,
    exceededCents: Math.max(0, savedCents - targetCents),
    done: savedCents >= targetCents,
  };
}

export type Required =
  | { kind: "done"; monthlyCents: 0 }
  | { kind: "no_deadline"; monthlyCents: null }
  | { kind: "overdue" | "this_month"; monthlyCents: Cents; months: number }
  | { kind: "monthly"; monthlyCents: Cents; months: number };

/**
 * Quanto guardar por mês, a partir de agora, para chegar no prazo (RN-78).
 *   sem juros:  ⌈ restante ÷ meses ⌉
 *   com juros:  PMT = (alvo − guardado·(1+i)ⁿ) · i ÷ ((1+i)ⁿ − 1), arredondado para cima
 * Recalculado a cada aporte: se você atrasou, o valor mensal sobe.
 */
export function requiredMonthly(g: { savedCents: Cents; targetCents: Cents; targetDate: ISODate | null; annualReturnBps?: number }, today: ISODate): Required {
  const p = progress(g.savedCents, g.targetCents);
  if (p.done) return { kind: "done", monthlyCents: 0 };
  if (!g.targetDate) return { kind: "no_deadline", monthlyCents: null };
  const n = monthsUntil(today, g.targetDate);
  if (n < 0) return { kind: "overdue", monthlyCents: p.remainingCents, months: n };
  if (n === 0) return { kind: "this_month", monthlyCents: p.remainingCents, months: 0 };
  const i = monthlyRate(g.annualReturnBps ?? 0);
  if (i === 0) return { kind: "monthly", monthlyCents: Math.ceil(p.remainingCents / n), months: n };
  const g1 = Math.pow(1 + i, n);
  const need = g.targetCents - g.savedCents * g1;
  if (need <= 0) return { kind: "monthly", monthlyCents: 0, months: n };
  return { kind: "monthly", monthlyCents: Math.ceil((need * i) / (g1 - 1)), months: n };
}

/** Meses até chegar no alvo com `monthly` por mês (null = nunca, ou > 50 anos). */
export function monthsToReach(savedCents: Cents, targetCents: Cents, monthlyCents: Cents, annualReturnBps = 0): number | null {
  if (savedCents >= targetCents) return 0;
  const i = monthlyRate(annualReturnBps);
  if (monthlyCents <= 0 && (i === 0 || savedCents <= 0)) return null;
  if (i === 0) return Math.ceil((targetCents - savedCents) / monthlyCents);
  for (let n = 1; n <= 600; n++) if (futureValue(savedCents, monthlyCents, n, i) >= targetCents - 0.5) return n;
  return null;
}

export type MonthAmount = { month: ISODate; cents: Cents };

/**
 * Ritmo real (RN-79): média PONDERADA dos aportes líquidos (aportes − retiradas)
 * dos últimos meses FECHADOS desde o início da meta, até 6 meses.
 *   ritmo = Σ (pₖ · vₖ) ÷ Σ pₖ, com peso pₖ = 1 no mês mais antigo … n no mais recente.
 * Meses sem aporte contam como 0 (ritmo irregular puxa a média para baixo).
 * Sem nenhum mês fechado: usa o que já entrou no mês atual (se houver).
 */
export function weightedPace(history: readonly MonthAmount[], today: ISODate, goalStart: ISODate, maxMonths = 6): Cents | null {
  const current = monthStart(today);
  const byMonth = new Map<string, number>();
  for (const h of history) byMonth.set(h.month.slice(0, 7), (byMonth.get(h.month.slice(0, 7)) ?? 0) + h.cents);
  const months: ISODate[] = [];
  for (let k = maxMonths; k >= 1; k--) {
    const m = addMonths(current, -k);
    if (m >= monthStart(goalStart)) months.push(m);
  }
  if (months.length === 0) {
    const now = byMonth.get(current.slice(0, 7)) ?? 0;
    return now > 0 ? now : null;
  }
  let num = 0;
  let den = 0;
  months.forEach((m, idx) => {
    const w = idx + 1;
    num += w * (byMonth.get(m.slice(0, 7)) ?? 0);
    den += w;
  });
  return Math.round(num / den);
}

export type PaceStatus = "done" | "ahead" | "on_track" | "behind" | "no_deadline" | "no_pace";

export type Estimate = {
  /** De onde veio o ritmo usado na estimativa. */
  basis: "plan" | "history" | "none";
  monthlyCents: Cents | null;
  months: number | null;
  /** Último dia do mês estimado de conclusão. */
  date: ISODate | null;
  status: PaceStatus;
  /** Diferença em meses contra o prazo (positivo = atraso). */
  deltaMonths: number | null;
};

/** Estimativa de conclusão e ritmo em relação ao prazo (RN-79/RN-80). */
export function estimate(
  g: { savedCents: Cents; targetCents: Cents; targetDate: ISODate | null; annualReturnBps?: number },
  pace: { planMonthlyCents?: Cents | null; historyMonthlyCents?: Cents | null },
  today: ISODate,
): Estimate {
  const current = monthStart(today);
  if (g.savedCents >= g.targetCents) {
    return { basis: "none", monthlyCents: 0, months: 0, date: today, status: "done", deltaMonths: null };
  }
  const basis = pace.planMonthlyCents && pace.planMonthlyCents > 0 ? "plan" : pace.historyMonthlyCents && pace.historyMonthlyCents > 0 ? "history" : "none";
  const monthly = basis === "plan" ? pace.planMonthlyCents! : basis === "history" ? pace.historyMonthlyCents! : null;
  const months = monthly ? monthsToReach(g.savedCents, g.targetCents, monthly, g.annualReturnBps) : null;
  const date = months !== null ? endOfMonth(addMonths(current, months)) : null;
  let status: PaceStatus;
  let deltaMonths: number | null = null;
  if (!g.targetDate) status = months === null ? "no_pace" : "no_deadline";
  else if (months === null) status = "no_pace";
  else {
    deltaMonths = months - monthsUntil(today, g.targetDate);
    status = deltaMonths < 0 ? "ahead" : deltaMonths === 0 ? "on_track" : "behind";
  }
  return { basis, monthlyCents: monthly, months, date, status, deltaMonths };
}

export const PACE_LABEL: Record<PaceStatus, string> = {
  done: "Concluída",
  ahead: "Adiantada",
  on_track: "No ritmo",
  behind: "Atrasada",
  no_deadline: "Sem prazo",
  no_pace: "Sem ritmo ainda",
};

// -----------------------------------------------------------------------------
// Capacidade de poupança (RN-81)
// -----------------------------------------------------------------------------
export type CapacityMonth = {
  month: ISODate;
  isProjection: boolean;
  incomeFixedCents: Cents;
  incomeVariableCents: Cents;
  expenseFixedCents: Cents;
  expenseVariableCents: Cents;
  savedCents: Cents;
};

export type Capacity = {
  /** Meses de histórico usados (do 1º mês com movimento até o mês passado). */
  months: number;
  incomeCents: Cents;
  fixedIncomeCents: Cents;
  variableIncomeCents: Cents;
  fixedExpenseCents: Cents;
  variableExpenseCents: Cents;
  /** Sobra mensal realista = renda − fixas − variáveis (pode ser negativa). */
  surplusCents: Cents;
  /** Já comprometido com metas (aportes planejados, equivalente mensal). */
  committedCents: Cents;
  /** Sobra livre = sobra − comprometido. */
  freeCents: Cents;
  avgSavedCents: Cents;
};

/**
 * renda       = receitas FIXAS do próximo mês (projeção) + média das receitas eventuais
 * fixas       = despesas fixas do próximo mês (recorrências e parcelas, projeção)
 * variáveis   = média das despesas variáveis dos meses fechados
 * sobra       = renda − fixas − variáveis
 * Meses antes do primeiro movimento não entram na média (não diluem um espaço novo).
 */
export function savingsCapacity(rows: readonly CapacityMonth[], committedCents: Cents): Capacity {
  const next = rows.find((r) => r.isProjection);
  const history = rows.filter((r) => !r.isProjection).sort((a, b) => a.month.localeCompare(b.month));
  const firstActive = history.findIndex((r) => r.incomeFixedCents + r.incomeVariableCents + r.expenseFixedCents + r.expenseVariableCents > 0);
  const used = firstActive === -1 ? [] : history.slice(firstActive);
  const avg = (f: (r: CapacityMonth) => number) => (used.length ? Math.round(used.reduce((a, r) => a + f(r), 0) / used.length) : 0);
  const fixedIncome = next?.incomeFixedCents ?? avg((r) => r.incomeFixedCents);
  const variableIncome = avg((r) => r.incomeVariableCents);
  const fixedExpense = next?.expenseFixedCents ?? avg((r) => r.expenseFixedCents);
  const variableExpense = avg((r) => r.expenseVariableCents);
  const income = fixedIncome + variableIncome;
  const surplus = income - fixedExpense - variableExpense;
  return {
    months: used.length,
    incomeCents: income,
    fixedIncomeCents: fixedIncome,
    variableIncomeCents: variableIncome,
    fixedExpenseCents: fixedExpense,
    variableExpenseCents: variableExpense,
    surplusCents: surplus,
    committedCents,
    freeCents: surplus - committedCents,
    avgSavedCents: avg((r) => r.savedCents),
  };
}

// -----------------------------------------------------------------------------
// Distribuição da sobra entre metas (RN-82)
// -----------------------------------------------------------------------------
export type PlanGoal = {
  id: string;
  name: string;
  priority: 1 | 2 | 3;
  remainingCents: Cents;
  requiredMonthlyCents: Cents | null;
  targetDate: ISODate | null;
};

export type Distribution = {
  allocations: { id: string; name: string; cents: Cents; requiredCents: Cents | null; covered: boolean }[];
  requiredTotalCents: Cents;
  surplusCents: Cents;
  feasible: boolean;
  shortfallCents: Cents;
  unallocatedCents: Cents;
};

const PRIORITY_WEIGHT = { 1: 3, 2: 2, 3: 1 } as const;

/**
 * 1º) metas COM prazo recebem o valor mensal necessário, por prioridade (alta
 *     primeiro) e, no empate, pelo prazo mais próximo;
 * 2º) o que sobrar vai para as metas SEM prazo, proporcional ao peso da
 *     prioridade (alta 3, média 2, baixa 1), sem passar do que falta;
 * Inviável quando a soma dos valores necessários passa da sobra.
 */
export function distribute(surplusCents: Cents, goals: readonly PlanGoal[]): Distribution {
  const active = goals.filter((g) => g.remainingCents > 0);
  const withDeadline = active
    .filter((g) => g.requiredMonthlyCents !== null)
    .sort((a, b) => a.priority - b.priority || (a.targetDate ?? "").localeCompare(b.targetDate ?? ""));
  const noDeadline = active.filter((g) => g.requiredMonthlyCents === null);
  const requiredTotal = withDeadline.reduce((a, g) => a + (g.requiredMonthlyCents ?? 0), 0);
  let left = Math.max(0, surplusCents);
  const alloc = new Map<string, number>();

  for (const g of withDeadline) {
    const want = Math.min(g.requiredMonthlyCents ?? 0, g.remainingCents);
    const give = Math.min(want, left);
    alloc.set(g.id, give);
    left -= give;
  }
  // Rodadas proporcionais (uma meta cheia devolve o excedente às outras).
  let pool = noDeadline.filter((g) => g.remainingCents > 0);
  while (left > 0 && pool.length) {
    const weights = pool.reduce((a, g) => a + PRIORITY_WEIGHT[g.priority], 0);
    let spent = 0;
    const next: PlanGoal[] = [];
    pool.forEach((g, idx) => {
      const share = idx === pool.length - 1 ? left - spent : Math.floor((left * PRIORITY_WEIGHT[g.priority]) / weights);
      const room = g.remainingCents - (alloc.get(g.id) ?? 0);
      const give = Math.max(0, Math.min(share, room));
      alloc.set(g.id, (alloc.get(g.id) ?? 0) + give);
      spent += give;
      if (room - give > 0) next.push(g);
    });
    left -= spent;
    if (spent === 0) break;
    pool = next;
  }

  return {
    allocations: [...withDeadline, ...noDeadline].map((g) => ({
      id: g.id,
      name: g.name,
      cents: alloc.get(g.id) ?? 0,
      requiredCents: g.requiredMonthlyCents,
      covered: g.requiredMonthlyCents === null || (alloc.get(g.id) ?? 0) >= Math.min(g.requiredMonthlyCents, g.remainingCents),
    })),
    requiredTotalCents: requiredTotal,
    surplusCents,
    feasible: surplusCents >= requiredTotal,
    shortfallCents: Math.max(0, requiredTotal - Math.max(0, surplusCents)),
    unallocatedCents: left,
  };
}

// -----------------------------------------------------------------------------
// Séries para o gráfico e simulador (RN-83/RN-84)
// -----------------------------------------------------------------------------
export type SeriesPoint = { month: ISODate; cents: number };

/** Guardado acumulado mês a mês (fim de cada mês), do início da meta até o mês atual. */
export function realizedSeries(initialCents: Cents, history: readonly MonthAmount[], startMonth: ISODate, today: ISODate): SeriesPoint[] {
  const byMonth = new Map<string, number>();
  for (const h of history) byMonth.set(h.month.slice(0, 7), (byMonth.get(h.month.slice(0, 7)) ?? 0) + h.cents);
  const out: SeriesPoint[] = [];
  let acc = initialCents;
  for (let m = monthStart(startMonth); m <= monthStart(today); m = addMonths(m, 1)) {
    acc += byMonth.get(m.slice(0, 7)) ?? 0;
    out.push({ month: m, cents: acc });
  }
  return out;
}

/** Projeção a partir de hoje com `monthly` por mês até atingir o alvo (ou `maxMonths`). */
export function projectedSeries(savedCents: Cents, targetCents: Cents, monthlyCents: Cents, annualReturnBps: number, today: ISODate, maxMonths = 120): SeriesPoint[] {
  const i = monthlyRate(annualReturnBps);
  const current = monthStart(today);
  const out: SeriesPoint[] = [{ month: current, cents: savedCents }];
  if (monthlyCents <= 0 && i === 0) return out;
  for (let n = 1; n <= maxMonths; n++) {
    const v = Math.round(futureValue(savedCents, monthlyCents, n, i));
    out.push({ month: addMonths(current, n), cents: v });
    if (v >= targetCents) break;
  }
  return out;
}

/** Linha ideal: reta do guardado no início até o alvo no prazo. */
export function idealSeries(startCents: Cents, targetCents: Cents, startMonth: ISODate, targetDate: ISODate): SeriesPoint[] {
  const n = Math.max(1, monthsUntil(startMonth, targetDate));
  return Array.from({ length: n + 1 }, (_, k) => ({
    month: addMonths(monthStart(startMonth), k),
    cents: Math.round(startCents + ((targetCents - startCents) * k) / n),
  }));
}

export type Simulation = { required: Required; estimate: Estimate; series: SeriesPoint[] };

/** Simulador "e se": muda aporte mensal, prazo, alvo e/ou rendimento sem salvar nada. */
export function simulate(
  g: { savedCents: Cents; targetCents: Cents; targetDate: ISODate | null; annualReturnBps: number },
  what: { monthlyCents?: Cents | null; targetDate?: ISODate | null; targetCents?: Cents; annualReturnBps?: number; historyMonthlyCents?: Cents | null },
  today: ISODate,
): Simulation {
  const goal = {
    savedCents: g.savedCents,
    targetCents: what.targetCents ?? g.targetCents,
    targetDate: what.targetDate === undefined ? g.targetDate : what.targetDate,
    annualReturnBps: what.annualReturnBps ?? g.annualReturnBps,
  };
  const required = requiredMonthly(goal, today);
  const est = estimate(goal, { planMonthlyCents: what.monthlyCents ?? null, historyMonthlyCents: what.historyMonthlyCents ?? null }, today);
  const series = est.monthlyCents ? projectedSeries(goal.savedCents, goal.targetCents, est.monthlyCents, goal.annualReturnBps, today) : [];
  return { required, estimate: est, series };
}

/**
 * Cenário "se eu reduzir X% na categoria Y" (RN-85): a economia mensal
 * (média da categoria × X%) soma ao ritmo e antecipa a meta em N meses.
 */
export function categoryCutScenario(
  g: { savedCents: Cents; targetCents: Cents; annualReturnBps: number },
  paceMonthlyCents: Cents,
  categoryMonthlyAvgCents: Cents,
  cutPct: number,
) {
  const extra = Math.round(categoryMonthlyAvgCents * Math.max(0, Math.min(1, cutPct)));
  const before = monthsToReach(g.savedCents, g.targetCents, paceMonthlyCents, g.annualReturnBps);
  const after = monthsToReach(g.savedCents, g.targetCents, paceMonthlyCents + extra, g.annualReturnBps);
  return {
    extraMonthlyCents: extra,
    monthsBefore: before,
    monthsAfter: after,
    monthsSaved: before !== null && after !== null ? before - after : null,
  };
}

/** Contribuição de cada membro (família): soma dos aportes líquidos confirmados. */
export function contributionsByMember(rows: readonly { memberId: string | null; cents: Cents }[]) {
  const m = new Map<string | null, number>();
  for (const r of rows) m.set(r.memberId, (m.get(r.memberId) ?? 0) + r.cents);
  const total = [...m.values()].reduce((a, v) => a + Math.max(0, v), 0);
  return [...m.entries()]
    .map(([memberId, cents]) => ({ memberId, cents, share: total > 0 ? Math.max(0, cents) / total : 0 }))
    .sort((a, b) => b.cents - a.cents);
}
