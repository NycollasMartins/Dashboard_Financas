"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth/session";
import { formToObject } from "@/lib/form-data";
import * as goals from "@/lib/goals/service";
import type { Simulation } from "@/lib/goals/math";
import type { GoalView } from "@/lib/goals/service";
import { createClient } from "@/lib/supabase/server";
import type { SimulateInput } from "@/lib/validation/goals";

/*
 * Server Actions de metas: só traduzem FormData ↔ API interna
 * (src/lib/goals/service.ts). Nenhuma regra mora aqui.
 */

async function ctx(): Promise<goals.Ctx> {
  const user = await requireUser();
  return { supabase: await createClient(), userId: user.id };
}
function refresh() {
  revalidatePath("/", "layout");
}

export async function saveGoalAction(_p: ActionState<{ id: string }>, formData: FormData): Promise<ActionState<{ id: string }>> {
  const raw = formToObject(formData);
  const c = await ctx();
  const res = raw.id ? await goals.atualizarMeta(c, raw) : await goals.criarMeta(c, raw);
  if (!res.ok) return fail(res.message, res.fieldErrors, raw);
  refresh();
  return ok(raw.id ? "Meta atualizada." : "Meta criada.", res.data);
}

export async function setGoalStatusAction(goalId: string, status: string): Promise<ActionState<never>> {
  const res = await goals.alterarStatusMeta(await ctx(), { goalId, status });
  if (!res.ok) return fail(res.message);
  refresh();
  const msg: Record<string, string> = { paused: "Meta pausada.", active: "Meta retomada.", archived: "Meta arquivada.", achieved: "Meta concluída." };
  return ok(msg[status] ?? "Meta atualizada.");
}

export async function deleteGoalAction(goalId: string): Promise<ActionState<never>> {
  const res = await goals.excluirMeta(await ctx(), goalId);
  if (!res.ok) return fail(res.message);
  refresh();
  return ok("Meta excluída.");
}

export type ContributionActionData = { id: string; achievedNow: boolean; goal: Pick<GoalView, "id" | "name" | "savedCents" | "targetCents"> };

export async function saveContributionAction(
  _p: ActionState<ContributionActionData>,
  formData: FormData,
): Promise<ActionState<ContributionActionData>> {
  const raw = formToObject(formData);
  const res = await goals.registrarAporte(await ctx(), raw);
  if (!res.ok) return fail(res.message, res.fieldErrors, raw);
  refresh();
  const g = res.data.goal;
  return ok(
    res.data.achievedNow ? `Meta “${g.name}” concluída! 🎉` : raw.kind === "withdrawal" ? "Retirada registrada." : "Aporte registrado.",
    { id: res.data.id, achievedNow: res.data.achievedNow, goal: { id: g.id, name: g.name, savedCents: g.savedCents, targetCents: g.targetCents } },
  );
}

export async function deleteContributionAction(id: string): Promise<ActionState<never>> {
  const res = await goals.excluirAporte(await ctx(), id);
  if (!res.ok) return fail(res.message);
  refresh();
  return ok("Movimento excluído.");
}

export async function confirmContributionAction(id: string): Promise<ActionState<never>> {
  const res = await goals.confirmarAportePrevisto(await ctx(), id);
  if (!res.ok) return fail(res.message);
  refresh();
  return ok("Aporte confirmado.");
}

export async function savePlanAction(_p: ActionState<{ recurrenceId: string }>, formData: FormData): Promise<ActionState<{ recurrenceId: string }>> {
  const raw = formToObject(formData);
  const res = await goals.definirAportePlanejado(await ctx(), raw);
  if (!res.ok) return fail(res.message, res.fieldErrors, raw);
  refresh();
  return ok("Aporte planejado salvo.", res.data);
}

export async function removePlanAction(goalId: string): Promise<ActionState<never>> {
  const res = await goals.removerAportePlanejado(await ctx(), goalId);
  if (!res.ok) return fail(res.message);
  refresh();
  return ok("Aporte planejado removido.");
}

/** Simulação no servidor (a tela usa as funções puras no cliente; isto serve a IA/bot e testes). */
export async function simulateGoalAction(input: SimulateInput): Promise<ActionState<Simulation>> {
  const res = await goals.simularMeta(await ctx(), input);
  if (!res.ok) return fail(res.message, res.fieldErrors);
  return ok(undefined, res.data);
}
