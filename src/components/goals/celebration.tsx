"use client";

import { useEffect, useState } from "react";
import { PartyPopper } from "lucide-react";

/*
 * Celebração sutil ao concluir uma meta. Disparada por evento global
 * (window "goal-achieved"), para funcionar de qualquer formulário.
 * Com prefers-reduced-motion: só o cartão, sem confete (CSS global zera animações).
 */
export function celebrateGoal(name: string) {
  window.dispatchEvent(new CustomEvent("goal-achieved", { detail: { name } }));
}

const COLORS = ["var(--primary)", "var(--savings)", "var(--income)", "var(--warning)", "var(--chart-5)"];

export function Celebration() {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    const on = (e: Event) => setName((e as CustomEvent<{ name: string }>).detail.name);
    window.addEventListener("goal-achieved", on);
    return () => window.removeEventListener("goal-achieved", on);
  }, []);
  useEffect(() => {
    if (!name) return;
    const t = setTimeout(() => setName(null), 3800);
    return () => clearTimeout(t);
  }, [name]);
  if (!name) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] grid place-items-center" role="status" aria-live="polite">
      <div aria-hidden className="absolute inset-0 overflow-hidden motion-reduce:hidden">
        {Array.from({ length: 28 }, (_, i) => (
          <span
            key={i}
            className="absolute top-[-5%] block h-3 w-1.5 rounded-sm animate-[confetti_2.6s_ease-in_forwards]"
            style={{
              left: `${(i * 37) % 100}%`,
              background: COLORS[i % COLORS.length],
              animationDelay: `${(i % 7) * 90}ms`,
              transform: `rotate(${(i * 47) % 360}deg)`,
            }}
          />
        ))}
      </div>
      <div className="mx-4 grid justify-items-center gap-2 rounded-3xl border bg-popover/95 px-8 py-6 text-center shadow-2xl animate-rise">
        <PartyPopper className="size-8 text-savings" aria-hidden />
        <p className="font-heading text-lg font-semibold">Meta concluída!</p>
        <p className="text-sm text-muted-foreground">Você chegou em “{name}”. Parabéns!</p>
      </div>
    </div>
  );
}
