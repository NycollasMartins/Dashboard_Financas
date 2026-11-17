"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth/session";
import { dbErrorMessage } from "@/lib/errors";
import { formToObject } from "@/lib/form-data";
import { createClient } from "@/lib/supabase/server";
import { profileSchema, uuidSchema } from "@/lib/validation/workspace";

/**
 * Alterna o espaço ativo (individual ↔ família).
 * A política de RLS de profiles só aceita last_workspace_id de um espaço do
 * qual o usuário é membro — mesmo que alguém forje o id, o banco recusa.
 */
export async function switchWorkspaceAction(workspaceId: string): Promise<ActionState> {
  const parsed = uuidSchema.safeParse(workspaceId);
  if (!parsed.success) return fail("Espaço inválido.");

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ last_workspace_id: parsed.data })
    .eq("id", user.id);

  if (error) return fail(dbErrorMessage(error, "Não foi possível trocar de espaço."));
  revalidatePath("/", "layout");
  return ok();
}

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = profileSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return fail("Confira os campos.", z.flattenError(parsed.error).fieldErrors);
  }
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", user.id);
  if (error) return fail(dbErrorMessage(error));
  revalidatePath("/", "layout");
  return ok("Perfil atualizado.");
}
