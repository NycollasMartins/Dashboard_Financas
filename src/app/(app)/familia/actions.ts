"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { dbErrorMessage } from "@/lib/errors";
import { formToObject } from "@/lib/form-data";
import { createClient } from "@/lib/supabase/server";
import {
  createHouseholdSchema,
  inviteSchema,
  memberRoleSchema,
  uuidSchema,
  workspaceNameSchema,
} from "@/lib/validation/workspace";

/*
 * Todas as actions usam o cliente com a sessão do usuário: quem decide se ele
 * PODE fazer algo é o banco (RLS + funções SECURITY DEFINER com checagens).
 * A validação com Zod aqui é para dar mensagens boas e barrar lixo cedo.
 */

const flat = (e: z.ZodError) => z.flattenError(e).fieldErrors as Record<string, string[] | undefined>;

function done(message?: string) {
  revalidatePath("/", "layout");
  return ok(message);
}

export async function createHouseholdAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formToObject(formData);
  const parsed = createHouseholdSchema.safeParse(raw);
  if (!parsed.success) return fail("Confira o nome.", flat(parsed.error), raw);

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_household", { p_name: parsed.data.name });
  if (error) return fail(dbErrorMessage(error, "Não foi possível criar a família."));
  return done("Família criada! Agora convide quem vai participar.");
}

export async function createInviteAction(
  _prev: ActionState<{ url: string; email: string }>,
  formData: FormData,
): Promise<ActionState<{ url: string; email: string }>> {
  const raw = formToObject(formData);
  const parsed = inviteSchema.safeParse(raw);
  if (!parsed.success) return fail("Confira os campos.", flat(parsed.error), raw);

  await requireUser();
  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("create_workspace_invite", {
    p_workspace_id: parsed.data.workspaceId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error || !token) return fail(dbErrorMessage(error, "Não foi possível criar o convite."), undefined, raw);

  revalidatePath("/familia");
  // O link é mostrado UMA vez para ser compartilhado (ex.: WhatsApp). Custo zero:
  // não dependemos do limite de e-mails do plano gratuito.
  return ok("Convite criado. Envie o link abaixo.", {
    url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/convite/${token}`,
    email: parsed.data.email,
  });
}

export async function revokeInviteAction(inviteId: string): Promise<ActionState> {
  if (!uuidSchema.safeParse(inviteId).success) return fail("Convite inválido.");
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId)
    .select("id");
  if (error || !data?.length) return fail(dbErrorMessage(error, "Não foi possível revogar o convite."));
  return done("Convite revogado.");
}

export async function changeMemberRoleAction(
  workspaceId: string,
  userId: string,
  role: string,
): Promise<ActionState> {
  const input = z
    .object({ workspaceId: uuidSchema, userId: uuidSchema, role: memberRoleSchema })
    .safeParse({ workspaceId, userId, role });
  if (!input.success) return fail("Dados inválidos.");

  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .update({ role: input.data.role })
    .eq("workspace_id", input.data.workspaceId)
    .eq("user_id", input.data.userId)
    .select("user_id");
  if (error || !data?.length) return fail(dbErrorMessage(error, "Você não tem permissão para alterar este papel."));
  return done("Papel atualizado.");
}

export async function removeMemberAction(workspaceId: string, userId: string): Promise<ActionState> {
  const input = z.object({ workspaceId: uuidSchema, userId: uuidSchema }).safeParse({ workspaceId, userId });
  if (!input.success) return fail("Dados inválidos.");

  const me = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", input.data.workspaceId)
    .eq("user_id", input.data.userId)
    .select("user_id");
  if (error || !data?.length) return fail(dbErrorMessage(error, "Você não tem permissão para remover este membro."));

  if (input.data.userId === me.id) {
    // Saiu da família: volta para o espaço pessoal.
    await supabase.from("profiles").update({ last_workspace_id: null }).eq("id", me.id);
    revalidatePath("/", "layout");
    redirect("/painel");
  }
  return done("Membro removido.");
}

export async function renameWorkspaceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ workspaceId: uuidSchema, name: workspaceNameSchema })
    .safeParse(formToObject(formData));
  if (!parsed.success) return fail("Confira o nome.", flat(parsed.error));

  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.workspaceId)
    .select("id");
  if (error || !data?.length) return fail(dbErrorMessage(error, "Apenas administradores podem renomear."));
  return done("Nome atualizado.");
}

export async function deleteHouseholdAction(workspaceId: string): Promise<ActionState> {
  if (!uuidSchema.safeParse(workspaceId).success) return fail("Espaço inválido.");
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("workspaces").delete().eq("id", workspaceId).select("id");
  if (error || !data?.length) return fail(dbErrorMessage(error, "Apenas o dono pode excluir a família."));
  revalidatePath("/", "layout");
  redirect("/painel");
}

export async function transferOwnershipAction(workspaceId: string, newOwnerId: string): Promise<ActionState> {
  const input = z.object({ workspaceId: uuidSchema, newOwnerId: uuidSchema }).safeParse({ workspaceId, newOwnerId });
  if (!input.success) return fail("Dados inválidos.");
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_workspace_ownership", {
    p_workspace_id: input.data.workspaceId,
    p_new_owner: input.data.newOwnerId,
  });
  if (error) return fail(dbErrorMessage(error, "Não foi possível transferir a posse."));
  return done("Posse transferida. Você continua como administrador.");
}
