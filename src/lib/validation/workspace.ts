import { z } from "zod";
import { emailSchema } from "./auth";

export const uuidSchema = z.uuid({ error: "Identificador inválido." });

export const workspaceNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Informe um nome." })
  .max(80, { error: "Use no máximo 80 caracteres." });

export const memberRoleSchema = z.enum(["admin", "member"], { error: "Papel inválido." });

export const createHouseholdSchema = z.object({ name: workspaceNameSchema });

export const inviteSchema = z.object({
  workspaceId: uuidSchema,
  email: emailSchema,
  role: memberRoleSchema.default("member"),
});

export const inviteTokenSchema = z.string().regex(/^[0-9a-f]{64}$/, { error: "Convite inválido." });

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, { error: "Informe seu nome." }).max(120),
});
