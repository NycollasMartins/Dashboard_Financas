"use server";

import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Salva a preferência "ocultar valores" no perfil (vale em qualquer aparelho).
 * Sem revalidate: a tela já trocou na hora pelo estado do cliente.
 */
export async function setHideAmountsAction(hide: boolean): Promise<ActionState<never>> {
  const parsed = z.boolean().safeParse(hide);
  if (!parsed.success) return fail("Valor inválido.");
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ hide_amounts: parsed.data }).eq("id", user.id);
  if (error) return fail("Não foi possível salvar sua preferência.");
  return ok();
}
