"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { publicEnv } from "@/lib/env";
import { authErrorMessage } from "@/lib/errors";
import { formToObject } from "@/lib/form-data";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";
import {
  newPasswordSchema,
  resetRequestSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";

const SITE = publicEnv.NEXT_PUBLIC_SITE_URL;

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Confira os campos destacados.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return fail(authErrorMessage(error));

  redirect(safeNextPath(parsed.data.next, SITE));
}

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Confira os campos destacados.", fieldErrors(parsed.error));

  const next = safeNextPath(parsed.data.next, SITE);
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // O template de e-mail monta: /auth/confirm?token_hash=...&next=<esta URL>
      emailRedirectTo: `${SITE}${next}`,
      data: { full_name: parsed.data.fullName },
    },
  });
  if (error) return fail(authErrorMessage(error));

  // Por segurança o Supabase não revela se o e-mail já existe: a mensagem é neutra.
  return ok(`Enviamos um link de confirmação para ${parsed.data.email}. Abra o e-mail para ativar sua conta.`);
}

export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetRequestSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Confira os campos destacados.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${SITE}/redefinir-senha`,
  });
  // Só mostramos erro de limite de envio; o resto recebe a mesma resposta neutra
  // (não revela se o e-mail tem conta).
  if (error && (error.status === 429 || error.code?.startsWith("over_"))) {
    return fail(authErrorMessage(error));
  }
  return ok("Se existir uma conta com este e-mail, você vai receber um link para redefinir a senha.");
}

export async function updatePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = newPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Confira os campos destacados.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return fail("Seu link expirou. Solicite a redefinição novamente.");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(authErrorMessage(error));

  redirect("/painel");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}
