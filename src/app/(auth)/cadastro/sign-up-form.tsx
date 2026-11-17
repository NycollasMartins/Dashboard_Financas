"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { Field, FormMessage, PasswordField, SubmitButton } from "@/components/forms/fields";
import { idleState } from "@/lib/action-state";
import { signUpAction } from "../actions";

export function SignUpForm() {
  const next = useSearchParams().get("next") ?? "";
  const [state, action] = useActionState(signUpAction, idleState);

  if (state.status === "success") {
    return (
      <div className="grid justify-items-center gap-4 text-center animate-rise">
        <div className="grid size-14 place-items-center rounded-2xl bg-income-muted text-income">
          <MailCheck className="size-7" />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <Field
        label="Seu nome"
        name="fullName"
        autoComplete="name"
        defaultValue={state.values?.fullName}
        required
        errors={state.fieldErrors?.fullName}
      />
      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        inputMode="email"
        required
        errors={state.fieldErrors?.email}
      />
      <PasswordField
        label="Senha"
        name="password"
        autoComplete="new-password"
        required
        hint="Mínimo de 8 caracteres, com letras e números."
        errors={state.fieldErrors?.password}
      />
      <SubmitButton size="lg" pendingText="Criando conta…" className="mt-2 w-full">
        Criar conta
      </SubmitButton>
    </form>
  );
}
