"use client";

import { useState } from "react";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Campo de valor com máscara BRL "da direita para a esquerda": digitar 5-0-0-0
 * mostra R$ 50,00. Abre o teclado numérico no iPhone (inputmode="decimal") e
 * envia o valor em CENTAVOS no input escondido `name`.
 */
export function MoneyInput({
  name,
  defaultCents = 0,
  label,
  autoFocus,
  size = "lg",
  invalid,
  describedBy,
  onChangeCents,
  tone,
}: {
  name: string;
  defaultCents?: number;
  label: string;
  autoFocus?: boolean;
  size?: "lg" | "md";
  invalid?: boolean;
  describedBy?: string;
  onChangeCents?: (cents: number) => void;
  tone?: "income" | "expense" | "transfer";
}) {
  const [cents, setCents] = useState(defaultCents);

  function update(raw: string) {
    const digits = raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, 11);
    const next = Number(digits || "0");
    setCents(next);
    onChangeCents?.(next);
  }

  return (
    <div className="grid gap-1">
      <input type="hidden" name={name} value={cents} />
      <input
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        inputMode="decimal"
        enterKeyHint="done"
        autoComplete="off"
        autoFocus={autoFocus}
        value={formatBRL(cents)}
        onChange={(e) => update(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Backspace") {
            e.preventDefault();
            const digits = String(cents).slice(0, -1);
            const next = Number(digits || "0");
            setCents(next);
            onChangeCents?.(next);
          }
        }}
        onFocus={(e) => {
          const el = e.currentTarget;
          requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
        }}
        className={cn(
          "w-full rounded-2xl border border-input bg-surface-2/60 text-center font-heading font-semibold text-money outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive",
          size === "lg" ? "h-20 text-4xl" : "h-12 text-xl",
          tone === "income" && "text-income",
          tone === "expense" && "text-expense",
        )}
      />
    </div>
  );
}
