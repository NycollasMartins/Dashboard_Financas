"use client";

import { useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";

type FieldProps = React.ComponentProps<typeof Input> & {
  label: string;
  name: string;
  errors?: string[];
  hint?: string;
};

export function Field({ label, name, errors, hint, className, ...props }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const hasError = Boolean(errors?.length);
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        aria-invalid={hasError || undefined}
        aria-describedby={cn(hasError && errorId, hint && hintId) || undefined}
        {...props}
      />
      {hint && !hasError && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={errorId} className="text-xs text-destructive">
          {errors![0]}
        </p>
      )}
    </div>
  );
}

export function PasswordField(props: Omit<FieldProps, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Field {...props} type={visible ? "text" : "password"} className="[&_input]:pr-12" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute top-[30px] right-1 grid size-10 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function SubmitButton({
  children,
  pendingText,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} className={className} {...props}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? (pendingText ?? children) : children}
    </Button>
  );
}

export function FormMessage({ state }: { state: ActionState<unknown> }) {
  if (!state.message || state.status === "idle") return null;
  const isError = state.status === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3.5 py-3 text-sm leading-relaxed animate-rise",
        isError
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-income/30 bg-income-muted text-income",
      )}
    >
      {state.message}
    </p>
  );
}
