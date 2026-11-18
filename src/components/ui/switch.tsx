"use client";

import { cn } from "@/lib/utils";

/** Interruptor acessível (role="switch"), alvo de toque ≥ 44 px. */
export function Switch({
  checked, onCheckedChange, label, disabled, className,
}: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn("group grid size-11 shrink-0 place-items-center rounded-full disabled:opacity-50", className)}
    >
      <span className={cn("relative h-6 w-10 rounded-full border transition-colors", checked ? "border-primary bg-primary" : "bg-surface-2")}>
        <span className={cn("absolute top-0.5 left-0.5 size-[18px] rounded-full bg-background shadow transition-transform", checked && "translate-x-4")} />
      </span>
    </button>
  );
}
