"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { authErrorMessage, dbErrorMessage } from "@/lib/errors";
import { formToObject } from "@/lib/form-data";
import { createClient } from "@/lib/supabase/server";
import { deleteAccountSchema, emailChangeSchema } from "@/lib/validation/auth";

const flat = (e: z.ZodError) => z.flattenError(e).fieldErrors as Record<string, string[] | undefined>;

/** Confere a senha atual (reautenticação) antes de ações sensíveis. */
async function verifyPassword(email: string, password: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? "Senha atual incorreta." : null;
}

export async function requestEmailChangeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formToObject(formData);
  const parsed = emailChangeSchema.safeParse(raw);
  if (!parsed.success) return fail("Confira os campos.", flat(parsed.error), raw);

  const user = await requireUser();
  if (parsed.data.newEmail === user.email.toLowerCase()) {
    return fail("Este já é o seu e-mail.", { newEmail: ["Informe um e-mail diferente do atual."] }, raw);
  }
  const wrong = await verifyPassword(user.email, parsed.data.password);
  if (wrong) return fail(wrong, { password: [wrong] }, raw);

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.newEmail },
    { emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/configuracoes` },
  );
  if (error) return fail(authErrorMessage(error), undefined, raw);

  return ok(
    `Enviamos um link de confirmação para ${user.email} e para ${parsed.data.newEmail}. ` +
      "O e-mail só muda depois que você confirmar nos dois.",
  );
}

export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = deleteAccountSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Confira os campos.", flat(parsed.error));

  const user = await requireUser();
  const wrong = await verifyPassword(user.email, parsed.data.password);
  if (wrong) return fail(wrong, { password: [wrong] });

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return fail(dbErrorMessage(error, "Não foi possível excluir a conta."));

  // O usuário não existe mais: limpa os cookies de sessão localmente.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/entrar?conta=excluida");
}
