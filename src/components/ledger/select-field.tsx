"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function SelectField({
  label,
  errors,
  children,
  className,
  ...props
}: React.ComponentProps<"select"> & { label: string; errors?: string[] }) {
  const id = `sel-${props.name}`;
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        aria-invalid={errors?.length ? true : undefined}
        className="h-11 w-full min-w-0 rounded-lg border border-input bg-surface-2/60 px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm"
        {...props}
      >
        {children}
      </select>
      {errors?.length ? <p className="text-xs text-destructive">{errors[0]}</p> : null}
    </div>
  );
}

