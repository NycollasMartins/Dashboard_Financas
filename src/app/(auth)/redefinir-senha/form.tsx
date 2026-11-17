"use client";

import { useActionState } from "react";
import { FormMessage, PasswordField, SubmitButton } from "@/components/forms/fields";
import { idleState } from "@/lib/action-state";
import { updatePasswordAction } from "../actions";
import { AuthCard } from "../auth-card";

/**
 * Chega-se aqui pelo link do e-mail (/auth/confirm cria a sessão de recuperação).
 * Sem sessão válida, a action responde com erro amigável.
 */
export default function ResetPasswordPage() {
  const [state, action] = useActionState(updatePasswordAction, idleState);

  return (
    <AuthCard title="Nova senha" description="Escolha uma senha nova para sua conta.">
      <form action={action} className="grid gap-4" noValidate>
        <FormMessage state={state} />
        <PasswordField
          label="Nova senha"
          name="password"
          autoComplete="new-password"
          required
          hint="Mínimo de 8 caracteres, com letras e números."
          errors={state.fieldErrors?.password}
        />
        <PasswordField
          label="Confirmar nova senha"
          name="confirm"
          autoComplete="new-password"
          required
          errors={state.fieldErrors?.confirm}
        />
        <SubmitButton size="lg" pendingText="Salvando…" className="w-full">
          Salvar nova senha
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
