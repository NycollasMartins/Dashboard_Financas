"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Field, FormMessage, SubmitButton } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { idleState } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import { updateProfileAction } from "../actions";

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const [state, action] = useActionState(updateProfileAction, idleState);
  useEffect(() => {
    if (state.status === "success" && state.message) toast.success(state.message);
  }, [state]);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <Field label="Nome" name="fullName" defaultValue={fullName} autoComplete="name" errors={state.fieldErrors?.fullName} />
      <Field label="E-mail" name="email" defaultValue={email} disabled hint="A troca de e-mail chega numa fase futura." />
      {state.status === "error" && <FormMessage state={state} />}
      <SubmitButton pendingText="Salvando…" className="justify-self-start">
        Salvar
      </SubmitButton>
    </form>
  );
}

export function ThemePicker() {
  const { resolvedTheme, setTheme } = useTheme();
  const options = [
    { value: "dark", label: "Escuro", icon: Moon },
    { value: "light", label: "Claro", icon: Sun },
  ] as const;
  return (
    <div role="radiogroup" aria-label="Tema" className="inline-grid grid-cols-2 gap-1 rounded-xl border bg-surface-2/50 p-1">
      {options.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          type="button"
          role="radio"
          aria-checked={resolvedTheme === value}
          variant="ghost"
          onClick={() => setTheme(value)}
          className={cn("min-w-28", resolvedTheme === value && "bg-card shadow-sm")}
        >
          <Icon /> {label}
        </Button>
      ))}
    </div>
  );
}
