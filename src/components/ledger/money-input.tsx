"use client";

import { useState } from "react";
import { formatBRL, parseBRL } from "@/lib/money";
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

  function set(next: number) {
    setCents(next);
    onChangeCents?.(next);
  }

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
        // Máscara da direita para a esquerda que NÃO depende da posição do cursor:
        // tocar no meio do campo (iPhone) e digitar sempre acrescenta no fim.
        // beforeinput funciona também nos teclados virtuais do Android (keydown vem "Unidentified").
        onBeforeInput={(e) => {
          const data = (e.nativeEvent as InputEvent).data;
          if (data == null) return;
          e.preventDefault();
          const typed = data.replace(/\D/g, "");
          if (!typed) return;
          const el = e.currentTarget;
          const replaceAll = el.selectionStart === 0 && el.selectionEnd === el.value.length && el.value.length > 0;
          set(Number(`${replaceAll ? "" : cents || ""}${typed}`.replace(/^0+/, "").slice(0, 11) || "0"));
        }}
        onPaste={(e) => {
          e.preventDefault();
          const parsed = parseBRL(e.clipboardData.getData("text"));
          if (parsed !== null && parsed >= 0) set(Math.min(parsed, 99_999_999_999));
        }}
        onKeyDown={(e) => {
          if (e.key === "Backspace" || e.key === "Delete") {
            e.preventDefault();
            const el = e.currentTarget;
            const all = el.selectionStart === 0 && el.selectionEnd === el.value.length;
            set(all ? 0 : Number(String(cents).slice(0, -1) || "0"));
          }
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
