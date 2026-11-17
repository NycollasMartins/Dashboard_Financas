import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { addMonths, monthStart, todayISO, type ISODate } from "@/lib/dates";
import { dbErrorMessage } from "@/lib/errors";
import type { Database } from "@/lib/supabase/database.types";
import {
  contributionSchema,
  goalSchema,
  goalStatusSchema,
  planSchema,
  simulateSchema,
  type ContributionInput,
  type GoalInput,
  type PlanInput,
  type SimulateInput,
} from "@/lib/validation/goals";
import { monthlyEquivalent } from "@/lib/domain/projection";
import {
  distribute,
  estimate,
  idealSeries,
  progress,
  projectedSeries,
  realizedSeries,
  requiredMonthly,
  savingsCapacity,
  simulate,
  weightedPace,
  type Capacity,
  type Distribution,
  type Estimate,
  type MonthAmount,
  type Progress,
  type Required,
  type SeriesPoint,
  type Simulation,
} from "./math";

/*
 * API INTERNA DE METAS (Fase 4) — documentada em docs/api-interna.md.
 *
 * Toda regra de metas passa por aqui: telas (Server Actions), e depois a IA
 * (Fase 5) e o bot do WhatsApp/Telegram (Fase 6). Cada função:
 *   1. valida a entrada com Zod (aceita FormData convertido ou JSON);
 *   2. usa o cliente Supabase recebido (com a sessão do usuário → RLS decide
 *      o que ele pode ver/alterar; o bot deverá passar um cliente com o JWT do
 *      usuário vinculado, NUNCA a secret key sem checagem);
 *   3. devolve `Result` (nunca lança para erros de negócio).
 */

export type Ctx = { supabase: SupabaseClient<Database>; userId: string; today?: ISODate };
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string[] | undefined> };

const fail = (message: string, fieldErrors?: Record<string, string[] | undefined>): { ok: false; message: string; fieldErrors?: Record<string, string[] | undefined> } => ({ ok: false, message, fieldErrors });
const fieldErrors = (e: z.ZodError) => z.flattenError(e).fieldErrors as Record<string, string[] | undefined>;
const todayOf = (ctx: Ctx) => ctx.today ?? todayISO();

// -----------------------------------------------------------------------------
// Tipos de saída
// -----------------------------------------------------------------------------
export type GoalView = {
  id: string;
  workspaceId: string;
  name: string;
  icon: string;
  color: string;
  status: "active" | "paused" | "achieved" | "archived";
  priority: 1 | 2 | 3;
  targetCents: number;
  targetDate: ISODate | null;
  initialCents: number;
  savedCents: number;
  plannedCents: number;
  withdrawnCents: number;
  reserveAccountId: string | null;
  annualReturnBps: number;
  notes: string | null;
  createdAt: string;
  achievedAt: string | null;
  lastContributionOn: ISODate | null;
  plan: { recurrenceId: string; amountCents: number; monthlyCents: number; frequency: "weekly" | "monthly" | "yearly"; day: number; accountId: string | null; autoConfirm: boolean } | null;
  progress: Progress;
  required: Required;
  paceCents: number | null;
  estimate: Estimate;
};

type SummaryRow = Database["public"]["Views"]["goal_summaries"]["Row"];

function toView(r: SummaryRow, history: readonly MonthAmount[], today: ISODate): GoalView {
  const plan = r.plan_recurrence_id
    ? {
        recurrenceId: r.plan_recurrence_id,
        amountCents: r.plan_amount_cents ?? 0,
        monthlyCents: monthlyEquivalent(r.plan_amount_cents ?? 0, r.plan_frequency ?? "monthly"),
        frequency: r.plan_frequency ?? "monthly",
        day: r.plan_day ?? 1,
        accountId: r.plan_account_id,
        autoConfirm: r.plan_auto_confirm ?? false,
      }
    : null;
  const g = {
    savedCents: r.saved_cents ?? 0,
    targetCents: r.target_cents ?? 0,
    targetDate: (r.target_date as ISODate | null) ?? null,
    annualReturnBps: r.annual_return_bps ?? 0,
  };
  const pace = weightedPace(history, today, (r.created_at ?? today).slice(0, 10) as ISODate);
  return {
    id: r.goal_id!,
    workspaceId: r.workspace_id!,
    name: r.name ?? "",
    icon: r.icon ?? "target",
    color: r.color ?? "#5eead4",
    status: (r.status ?? "active") as GoalView["status"],
    priority: (r.priority ?? 2) as 1 | 2 | 3,
    targetCents: g.targetCents,
    targetDate: g.targetDate,
    initialCents: r.initial_cents ?? 0,
    savedCents: g.savedCents,
    plannedCents: r.planned_cents ?? 0,
    withdrawnCents: r.withdrawn_cents ?? 0,
    reserveAccountId: r.reserve_account_id,
    annualReturnBps: g.annualReturnBps,
    notes: r.notes,
    createdAt: r.created_at ?? "",
    achievedAt: r.achieved_at,
    lastContributionOn: (r.last_contribution_on as ISODate | null) ?? null,
    plan,
    progress: progress(g.savedCents, g.targetCents),
    required: requiredMonthly(g, today),
    paceCents: pace,
    estimate: estimate(g, { planMonthlyCents: plan?.monthlyCents ?? null, historyMonthlyCents: pace }, today),
  };
}

function monthly(rows: readonly { goal_id: string; amount_cents: number; contributed_on: string }[]) {
  const by = new Map<string, MonthAmount[]>();
  for (const r of rows) {
    const list = by.get(r.goal_id) ?? [];
    list.push({ month: monthStart(r.contributed_on as ISODate), cents: r.amount_cents });
    by.set(r.goal_id, list);
  }
  return by;
}

// -----------------------------------------------------------------------------
// Consultas
// -----------------------------------------------------------------------------
/** Metas do espaço com progresso, mensal necessário, ritmo e estimativa. */
export async function listarMetas(ctx: Ctx, workspaceId: string, opts: { includeArchived?: boolean } = {}): Promise<Result<GoalView[]>> {
  const today = todayOf(ctx);
  let q = ctx.supabase.from("goal_summaries").select("*").eq("workspace_id", workspaceId);
  if (!opts.includeArchived) q = q.neq("status", "archived");
  const [goals, contribs] = await Promise.all([
    q.order("priority").order("target_date", { nullsFirst: false }).order("name"),
    ctx.supabase
      .from("goal_contributions")
      .select("goal_id, amount_cents, contributed_on")
      .eq("workspace_id", workspaceId)
      .eq("is_planned", false)
      .gte("contributed_on", addMonths(monthStart(today), -7)),
  ]);
  if (goals.error) return fail(dbErrorMessage(goals.error));
  if (contribs.error) return fail(dbErrorMessage(contribs.error));
  const hist = monthly(contribs.data);
  return { ok: true, data: goals.data.map((g) => toView(g, hist.get(g.goal_id!) ?? [], today)) };
}

export type ContributionView = {
  id: string;
  amountCents: number;
  contributedOn: ISODate;
  accountId: string | null;
  memberId: string | null;
  note: string | null;
  isPlanned: boolean;
  fromPlan: boolean;
  createdBy: string | null;
};

export type GoalDetail = {
  goal: GoalView;
  contributions: ContributionView[];
  members: { memberId: string | null; cents: number }[];
  series: { realized: SeriesPoint[]; projected: SeriesPoint[]; ideal: SeriesPoint[] };
};

/** Detalhe de uma meta: histórico, contribuição por membro e séries do gráfico. */
export async function consultarProgressoMeta(ctx: Ctx, goalId: string): Promise<Result<GoalDetail>> {
  if (!z.uuid().safeParse(goalId).success) return fail("Meta inválida.");
  const today = todayOf(ctx);
  const [g, c] = await Promise.all([
    ctx.supabase.from("goal_summaries").select("*").eq("goal_id", goalId).maybeSingle(),
    ctx.supabase
      .from("goal_contributions")
      .select("id, amount_cents, contributed_on, account_id, member_user_id, created_by, note, is_planned, recurrence_id")
      .eq("goal_id", goalId)
      .order("contributed_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  if (g.error) return fail(dbErrorMessage(g.error));
  if (!g.data) return fail("Meta não encontrada.");
  if (c.error) return fail(dbErrorMessage(c.error));

  const confirmed = c.data.filter((x) => !x.is_planned);
  const history = confirmed.map((x) => ({ month: monthStart(x.contributed_on as ISODate), cents: x.amount_cents }));
  const goal = toView(g.data, history, today);
  const start = monthStart((goal.createdAt.slice(0, 10) || today) as ISODate);
  const firstContribution = confirmed.at(-1)?.contributed_on as ISODate | undefined;
  const startMonth = firstContribution && firstContribution < start ? monthStart(firstContribution) : start;
  const membersMap = new Map<string | null, number>();
  for (const x of confirmed) {
    const k = x.member_user_id ?? x.created_by;
    membersMap.set(k, (membersMap.get(k) ?? 0) + x.amount_cents);
  }
  const pace = goal.estimate.monthlyCents ?? 0;
  return {
    ok: true,
    data: {
      goal,
      contributions: c.data.map((x) => ({
        id: x.id,
        amountCents: x.amount_cents,
        contributedOn: x.contributed_on as ISODate,
        accountId: x.account_id,
        memberId: x.member_user_id ?? x.created_by,
        note: x.note,
        isPlanned: x.is_planned,
        fromPlan: Boolean(x.recurrence_id),
        createdBy: x.created_by,
      })),
      members: [...membersMap.entries()].map(([memberId, cents]) => ({ memberId, cents })).sort((a, b) => b.cents - a.cents),
      series: {
        realized: realizedSeries(goal.initialCents, history, startMonth, today),
        projected: goal.progress.done || pace <= 0 ? [] : projectedSeries(goal.savedCents, goal.targetCents, pace, goal.annualReturnBps, today),
        ideal: goal.targetDate ? idealSeries(goal.initialCents, goal.targetCents, startMonth, goal.targetDate) : [],
      },
    },
  };
}

/** Simulador "e se" (não salva nada). */
export async function simularMeta(ctx: Ctx, input: SimulateInput): Promise<Result<Simulation>> {
  const parsed = simulateSchema.safeParse(input);
  if (!parsed.success) return fail("Confira os valores da simulação.", fieldErrors(parsed.error));
  const today = todayOf(ctx);
  const [g, c] = await Promise.all([
    ctx.supabase.from("goal_summaries").select("*").eq("goal_id", parsed.data.goalId).maybeSingle(),
    ctx.supabase
      .from("goal_contributions")
      .select("goal_id, amount_cents, contributed_on")
      .eq("goal_id", parsed.data.goalId)
      .eq("is_planned", false)
      .gte("contributed_on", addMonths(monthStart(today), -7)),
  ]);
  if (g.error || !g.data) return fail("Meta não encontrada.");
  const v = toView(g.data, monthly(c.data ?? []).get(parsed.data.goalId) ?? [], today);
  return {
    ok: true,
    data: simulate(
      { savedCents: v.savedCents, targetCents: v.targetCents, targetDate: v.targetDate, annualReturnBps: v.annualReturnBps },
      {
        // Sem aporte informado, simula com o ritmo atual (plano ou histórico).
        monthlyCents: parsed.data.monthlyCents ?? v.estimate.monthlyCents,
        targetDate: parsed.data.targetDate as ISODate | null | undefined,
        targetCents: parsed.data.targetCents,
        annualReturnBps: parsed.data.annualReturnBps,
      },
      today,
    ),
  };
}

export type Planning = {
  capacity: Capacity;
  distribution: Distribution;
  goals: GoalView[];
};

/** Visão "Planejamento": sobra mensal, compromissos, viabilidade e sugestão. */
export async function consultarPlanejamento(ctx: Ctx, workspaceId: string): Promise<Result<Planning>> {
  const [goals, cap] = await Promise.all([
    listarMetas(ctx, workspaceId),
    ctx.supabase.rpc("planning_capacity_inputs", { p_workspace_id: workspaceId, p_months: 6 }),
  ]);
  if (!goals.ok) return goals;
  if (cap.error) return fail(dbErrorMessage(cap.error));
  const active = goals.data.filter((g) => g.status === "active");
  const committed = active.reduce((a, g) => a + (g.plan?.monthlyCents ?? 0), 0);
  const capacity = savingsCapacity(
    cap.data.map((r) => ({
      month: r.month as ISODate,
      isProjection: r.is_projection,
      incomeFixedCents: r.income_fixed_cents,
      incomeVariableCents: r.income_variable_cents,
      expenseFixedCents: r.expense_fixed_cents,
      expenseVariableCents: r.expense_variable_cents,
      savedCents: r.saved_cents,
    })),
    committed,
  );
  const distribution = distribute(
    capacity.surplusCents,
    active.map((g) => ({
      id: g.id,
      name: g.name,
      priority: g.priority,
      remainingCents: g.progress.remainingCents,
      requiredMonthlyCents: g.required.kind === "no_deadline" ? null : (g.required.monthlyCents ?? 0),
      targetDate: g.targetDate,
    })),
  );
  return { ok: true, data: { capacity, distribution, goals: goals.data } };
}

// -----------------------------------------------------------------------------
// Comandos
// -----------------------------------------------------------------------------
function goalRow(v: GoalInput) {
  return {
    workspace_id: v.workspaceId,
    name: v.name,
    icon: v.icon,
    color: v.color,
    target_cents: v.targetCents,
    target_date: v.targetDate ?? null,
    priority: v.priority,
    initial_cents: v.initialCents,
    reserve_account_id: v.reserveAccountId ?? null,
    annual_return_bps: Math.round(v.annualReturnPct * 100),
    notes: v.notes ?? null,
  };
}

/** Cria uma meta (individual ou da família, conforme o espaço). */
export async function criarMeta(ctx: Ctx, input: unknown): Promise<Result<{ id: string }>> {
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return fail("Confira os campos destacados.", fieldErrors(parsed.error));
  const { data, error } = await ctx.supabase.from("goals").insert(goalRow(parsed.data)).select("id").single();
  if (error) return fail(error.code === "23505" ? "Já existe uma meta com esse nome." : dbErrorMessage(error));
  return { ok: true, data: { id: data.id } };
}

export async function atualizarMeta(ctx: Ctx, input: unknown): Promise<Result<{ id: string }>> {
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return fail("Confira os campos destacados.", fieldErrors(parsed.error));
  if (!parsed.data.id) return fail("Meta inválida.");
  const { workspace_id: _ws, ...row } = goalRow(parsed.data);
  void _ws;
  const { error } = await ctx.supabase.from("goals").update(row).eq("id", parsed.data.id);
  if (error) return fail(error.code === "23505" ? "Já existe uma meta com esse nome." : dbErrorMessage(error));
  return { ok: true, data: { id: parsed.data.id } };
}

/** Pausar, retomar, arquivar ou reabrir. Concluída é automática (ao atingir o alvo). */
export async function alterarStatusMeta(ctx: Ctx, input: unknown): Promise<Result<{ status: string }>> {
  const parsed = goalStatusSchema.safeParse(input);
  if (!parsed.success) return fail("Status inválido.");
  const { data, error } = await ctx.supabase
    .from("goals")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.goalId)
    .select("status")
    .single();
  if (error) return fail(dbErrorMessage(error));
  return { ok: true, data: { status: data.status } };
}

export async function excluirMeta(ctx: Ctx, goalId: string): Promise<Result<null>> {
  if (!z.uuid().safeParse(goalId).success) return fail("Meta inválida.");
  const { error, count } = await ctx.supabase.from("goals").delete({ count: "exact" }).eq("id", goalId);
  if (error) return fail(dbErrorMessage(error));
  if (!count) return fail("Você não tem permissão para excluir esta meta.");
  return { ok: true, data: null };
}

export type ContributionResult = { id: string; goal: GoalView; achievedNow: boolean };

/**
 * Registra um APORTE (kind "deposit") ou uma RETIRADA (kind "withdrawal", com
 * motivo). Não é despesa: o dinheiro sai da conta escolhida e vai para a
 * reserva da meta (ou volta dela, na retirada) — ADR-0016.
 */
export async function registrarAporte(ctx: Ctx, input: unknown): Promise<Result<ContributionResult>> {
  const parsed = contributionSchema.safeParse(input);
  if (!parsed.success) return fail("Confira os campos destacados.", fieldErrors(parsed.error));
  const v: ContributionInput = parsed.data;
  const before = await ctx.supabase.from("goals").select("status").eq("id", v.goalId).maybeSingle();
  if (before.error || !before.data) return fail("Meta não encontrada.");
  const { data, error } = await ctx.supabase
    .from("goal_contributions")
    .insert({
      workspace_id: v.workspaceId,
      goal_id: v.goalId,
      amount_cents: v.kind === "withdrawal" ? -v.amountCents : v.amountCents,
      contributed_on: v.contributedOn,
      account_id: v.accountId ?? null,
      member_user_id: v.memberUserId ?? null,
      note: v.note ?? null,
      source: v.source,
    })
    .select("id")
    .single();
  if (error) return fail(dbErrorMessage(error));
  const after = await listarMetas(ctx, v.workspaceId, { includeArchived: true });
  const goal = after.ok ? after.data.find((g) => g.id === v.goalId) : undefined;
  if (!goal) return fail("Aporte salvo, mas não consegui recarregar a meta.");
  return { ok: true, data: { id: data.id, goal, achievedNow: before.data.status !== "achieved" && goal.status === "achieved" } };
}

export async function excluirAporte(ctx: Ctx, contributionId: string): Promise<Result<null>> {
  if (!z.uuid().safeParse(contributionId).success) return fail("Aporte inválido.");
  const { error, count } = await ctx.supabase.from("goal_contributions").delete({ count: "exact" }).eq("id", contributionId);
  if (error) return fail(dbErrorMessage(error));
  if (!count) return fail("Você só pode excluir aportes que você registrou (ou sendo admin).");
  return { ok: true, data: null };
}

/** Confirma um aporte PREVISTO (gerado pelo aporte planejado). */
export async function confirmarAportePrevisto(ctx: Ctx, contributionId: string): Promise<Result<null>> {
  if (!z.uuid().safeParse(contributionId).success) return fail("Aporte inválido.");
  const { error, count } = await ctx.supabase
    .from("goal_contributions")
    .update({ is_planned: false }, { count: "exact" })
    .eq("id", contributionId)
    .eq("is_planned", true);
  if (error) return fail(dbErrorMessage(error));
  if (!count) return fail("Aporte não encontrado ou já confirmado.");
  return { ok: true, data: null };
}

/**
 * Define (ou troca) o aporte planejado recorrente: reutiliza `recurrences` com
 * goal_id. Os previstos aparecem na meta e podem ser confirmados.
 */
export async function definirAportePlanejado(ctx: Ctx, input: unknown): Promise<Result<{ recurrenceId: string }>> {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return fail("Confira os campos destacados.", fieldErrors(parsed.error));
  const v: PlanInput = parsed.data;
  const goal = await ctx.supabase.from("goals").select("name").eq("id", v.goalId).maybeSingle();
  if (goal.error || !goal.data) return fail("Meta não encontrada.");
  // Um plano ativo por meta: o anterior é encerrado (histórico fica).
  const old = await ctx.supabase.from("recurrences").select("id").eq("goal_id", v.goalId).eq("is_active", true);
  if (old.error) return fail(dbErrorMessage(old.error));
  for (const r of old.data) {
    await ctx.supabase.from("goal_contributions").delete().eq("recurrence_id", r.id).eq("is_planned", true).gte("contributed_on", v.startsOn);
    const { error } = await ctx.supabase.from("recurrences").update({ is_active: false }).eq("id", r.id);
    if (error) return fail(dbErrorMessage(error));
  }
  const { data, error } = await ctx.supabase
    .from("recurrences")
    .insert({
      workspace_id: v.workspaceId,
      goal_id: v.goalId,
      kind: "expense",
      description: `Guardar para ${goal.data.name}`,
      amount_cents: v.amountCents,
      payment_method: "transfer",
      account_id: v.accountId ?? null,
      frequency: v.frequency,
      day_of_month: v.dayOfMonth,
      starts_on: v.startsOn,
      auto_confirm: v.autoConfirm,
      member_user_id: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return fail(dbErrorMessage(error));
  return { ok: true, data: { recurrenceId: data.id } };
}

export async function removerAportePlanejado(ctx: Ctx, goalId: string): Promise<Result<null>> {
  if (!z.uuid().safeParse(goalId).success) return fail("Meta inválida.");
  const today = todayOf(ctx);
  const plans = await ctx.supabase.from("recurrences").select("id").eq("goal_id", goalId).eq("is_active", true);
  if (plans.error) return fail(dbErrorMessage(plans.error));
  for (const r of plans.data) {
    await ctx.supabase.from("goal_contributions").delete().eq("recurrence_id", r.id).eq("is_planned", true).gte("contributed_on", today);
    const { error } = await ctx.supabase.from("recurrences").update({ is_active: false }).eq("id", r.id);
    if (error) return fail(dbErrorMessage(error));
  }
  return { ok: true, data: null };
}
