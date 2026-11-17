"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Field, FormMessage, PasswordField, SubmitButton } from "@/components/forms/fields";
import { idleState } from "@/lib/action-state";
import { signInAction } from "../actions";

export function SignInForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const linkError = params.get("erro") === "link";
  const [state, action] = useActionState(signInAction, idleState);

  return (
    <form action={action} className="grid gap-4" noValidate>
      {linkError && state.status === "idle" && (
        <FormMessage state={{ status: "error", message: "Link inválido ou expirado. Tente novamente." }} />
      )}
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        errors={state.fieldErrors?.email}
      />
      <div className="grid gap-1.5">
        <PasswordField
          label="Senha"
          name="password"
          autoComplete="current-password"
          required
          errors={state.fieldErrors?.password}
        />
        <Link
          href="/recuperar-senha"
          className="justify-self-end text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Esqueci minha senha
        </Link>
      </div>
      <SubmitButton size="lg" pendingText="Entrando…" className="mt-2 w-full">
        Entrar
      </SubmitButton>
    </form>
  );
}
