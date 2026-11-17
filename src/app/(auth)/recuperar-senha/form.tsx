"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/forms/fields";
import { idleState } from "@/lib/action-state";
import { requestPasswordResetAction } from "../actions";
import { AuthCard } from "../auth-card";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(requestPasswordResetAction, idleState);

  return (
    <AuthCard
      title="Recuperar senha"
      description="Informe seu e-mail e enviaremos um link para criar uma nova senha."
      footer={
        <Link href="/entrar" className="font-medium text-primary underline-offset-4 hover:underline">
          Voltar para o login
        </Link>
      }
    >
      <form action={action} className="grid gap-4" noValidate>
        <FormMessage state={state} />
        {state.status !== "success" && (
          <>
            <Field
              label="E-mail"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              errors={state.fieldErrors?.email}
            />
            <SubmitButton size="lg" pendingText="Enviando…" className="w-full">
              Enviar link
            </SubmitButton>
          </>
        )}
      </form>
    </AuthCard>
  );
}
