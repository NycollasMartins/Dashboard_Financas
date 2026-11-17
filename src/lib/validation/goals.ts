import { z } from "zod";

/*
 * Entradas da API interna de metas (src/lib/goals/service.ts). Os mesmos
 * schemas valem para formulários, para a IA (Fase 5) e para o bot (Fase 6):
 * aceitam string (FormData) ou número/boolean (JSON).
 */

const uuid = z.uuid({ error: "Seleção inválida." });
const optionalUuid = z.preprocess((v) => (v === "" || v == null ? undefined : v), uuid.optional());
const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() || undefined : v), z.string().max(max).optional());
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Data inválida." });
const optionalDate = z.preprocess((v) => (v === "" || v == null ? undefined : v), isoDate.optional());
const bool = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());
const cents = (msg = "Informe o valor.") =>
  z.coerce
    .number({ error: msg })
    .int({ error: "Valor inválido." })
    .positive({ error: "O valor precisa ser maior que zero." })
    .max(99_999_999_99, { error: "Valor muito alto." });

export const GOAL_ICONS = ["target", "car", "plane", "shield", "house", "graduation-cap", "heart", "gift", "laptop", "baby", "piggy-bank", "sparkles"] as const;
export const GOAL_STATUSES = ["active", "paused", "achieved", "archived"] as const;
export const GOAL_STATUS_LABEL: Record<(typeof GOAL_STATUSES)[number], string> = {
  active: "Ativa",
  paused: "Pausada",
  achieved: "Concluída",
  archived: "Arquivada",
};
export const PRIORITY_LABEL = { 1: "Alta", 2: "Média", 3: "Baixa" } as const;

export const goalSchema = z.object({
  id: optionalUuid,
  workspaceId: uuid,
  name: z.string().trim().min(1, { error: "Dê um nome para a meta." }).max(60),
  icon: z.enum(GOAL_ICONS).default("target"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#5eead4"),
  targetCents: cents("Informe o valor da meta."),
  targetDate: optionalDate,
  priority: z.coerce.number().int().min(1).max(3).default(2),
  initialCents: z.coerce.number().int().min(0).max(99_999_999_99).default(0),
  reserveAccountId: optionalUuid,
  /** % ao ano informado pela pessoa (ex.: "10,5") → pontos-base. */
  annualReturnPct: z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(",", ".") || 0) : (v ?? 0)),
    z.number({ error: "Rendimento inválido." }).min(0).max(50, { error: "Use até 50% ao ano." }),
  ),
  notes: optionalText(500),
});
export type GoalInput = z.infer<typeof goalSchema>;

export const goalStatusSchema = z.object({ goalId: uuid, status: z.enum(GOAL_STATUSES) });

export const contributionSchema = z
  .object({
    workspaceId: uuid,
    goalId: uuid,
    kind: z.enum(["deposit", "withdrawal"]).default("deposit"),
    amountCents: cents(),
    contributedOn: isoDate,
    accountId: optionalUuid,
    memberUserId: optionalUuid,
    note: optionalText(200),
    source: z.enum(["manual", "whatsapp", "telegram"]).default("manual"),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "withdrawal" && !v.note)
      ctx.addIssue({ code: "custom", path: ["note"], message: "Conte o motivo da retirada." });
  });
export type ContributionInput = z.infer<typeof contributionSchema>;

export const planSchema = z.object({
  workspaceId: uuid,
  goalId: uuid,
  amountCents: cents(),
  frequency: z.enum(["weekly", "monthly", "yearly"]).default("monthly"),
  dayOfMonth: z.coerce.number().int().min(1).max(31),
  accountId: optionalUuid,
  startsOn: isoDate,
  autoConfirm: bool,
});
export type PlanInput = z.infer<typeof planSchema>;

export const simulateSchema = z.object({
  goalId: uuid,
  monthlyCents: z.coerce.number().int().min(0).max(99_999_999_99).optional(),
  targetDate: z.union([isoDate, z.null()]).optional(),
  targetCents: z.coerce.number().int().positive().optional(),
  annualReturnBps: z.coerce.number().int().min(0).max(5000).optional(),
});
export type SimulateInput = z.infer<typeof simulateSchema>;
