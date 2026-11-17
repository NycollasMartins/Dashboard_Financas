"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth/session";
import { dbErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { inviteTokenSchema } from "@/lib/validation/workspace";

export async function acceptInviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = inviteTokenSchema.safeParse(formData.get("token"));
  if (!token.success) return fail("Convite inválido.");

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_workspace_invite", { p_token: token.data });
  if (error) return fail(dbErrorMessage(error, "Não foi possível aceitar o convite."));

  revalidatePath("/", "layout");
  redirect("/painel");
}
