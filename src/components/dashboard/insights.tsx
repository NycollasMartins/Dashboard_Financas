"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight, Info, Lightbulb, ThumbsUp } from "lucide-react";
import { usePrivacyHidden } from "@/components/privacy/privacy";
import type { Insight } from "@/lib/analytics/insights";
import { cn } from "@/lib/utils";

const ICON = { bad: AlertTriangle, warning: AlertTriangle, good: ThumbsUp, info: Info } as const;
const LABEL = { bad: "Alerta", warning: "Atenção", good: "Bom sinal", info: "Informação" } as const;

/** Insights por regras (sem IA). Com "ocultar valores", troca pelo texto sem números. */
export function InsightsCard({ insights }: { insights: Insight[] }) {
  const hidden = usePrivacyHidden();
  if (insights.length === 0) return null;
  return (
    <section aria-labelledby="insights-title" className="grid gap-3 rounded-2xl border bg-card p-4 animate-rise sm:p-5">
      <h2 id="insights-title" className="flex items-center gap-2 text-base font-semibold">
        <Lightbulb className="size-4 text-primary" /> O que chama atenção
      </h2>
      <ul className="grid gap-2">
        {insights.map((i) => {
          const Icon = ICON[i.tone];
          const body = (
            <>
              <span className={cn(
                "grid size-8 shrink-0 place-items-center rounded-lg",
                i.tone === "bad" && "bg-destructive/12 text-destructive",
                i.tone === "warning" && "bg-warning/15 text-warning",
                i.tone === "good" && "bg-income-muted text-income",
                i.tone === "info" && "bg-info/15 text-info",
              )}>
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="flex-1 text-sm">
                <span className="sr-only">{LABEL[i.tone]}: </span>
                {hidden ? i.privateText : i.text}
              </span>
              {i.href && <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
            </>
          );
          return (
            <li key={i.id}>
              {i.href ? (
                <Link href={i.href} className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-accent/60">{body}</Link>
              ) : (
                <div className="flex min-h-11 items-center gap-3 px-2 py-1.5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
