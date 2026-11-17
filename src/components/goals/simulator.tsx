"use client";

import { useMemo, useState } from "react";
import { FlaskConical, RotateCcw, Scissors } from "lucide-react";
import { MoneyInput } from "@/components/ledger/money-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePrivacyHidden } from "@/components/privacy/privacy";
import type { ISODate } from "@/lib/dates";
import { categoryCutScenario, endOfMonth, simulate, PACE_LABEL } from "@/lib/goals/math";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PaceBadge, shortMonth } from "./goal-visuals";

type Props = {
  goal: { savedCents: number; targetCents: number; targetDate: ISODate | null; annualReturnBps: number };
  paceCents: number | null;
  today: ISODate;
  categories: { id: string; name: string; avgMonthlyCents: number }[];
};

/**
 * Simulador "e se" (RN-84/85): muda aporte, prazo, alvo e rendimento e mostra
 * o resultado na hora — usa as MESMAS funções puras da tela (src/lib/goals/math.ts).
 * Nada é salvo.
 */
export function GoalSimulator({ goal, paceCents, today, categories }: Props) {
  const hidden = usePrivacyHidden();
  const [k, setK] = useState(0); // reset
  const [monthly, setMonthly] = useState<number>(paceCents ?? 0);
  const [deadline, setDeadline] = useState<string>(goal.targetDate?.slice(0, 7) ?? "");
  const [target, setTarget] = useState(goal.targetCents);
  const [rate, setRate] = useState(String(goal.annualReturnBps / 100).replace(".", ","));
  const [cat, setCat] = useState(categories[0]?.id ?? "");
  const [cut, setCut] = useState(0.2);
  const bps = Math.round(Math.min(50, Math.max(0, Number(rate.replace(",", ".")) || 0)) * 100);
  const money = (c: number | null | undefined) => (c == null ? "—" : hidden ? "R$ ••••" : formatBRL(c));

  const sim = useMemo(
    () =>
      simulate(goal, {
        monthlyCents: monthly,
        targetDate: deadline ? endOfMonth(`${deadline}-01` as ISODate) : null,
        targetCents: target || goal.targetCents,
        annualReturnBps: bps,
      }, today),
    [goal, monthly, deadline, target, bps, today],
  );
  const category = categories.find((c) => c.id === cat);
  const cutResult = category ? categoryCutScenario({ ...goal, targetCents: target || goal.targetCents, annualReturnBps: bps }, monthly, category.avgMonthlyCents, cut) : null;

  return (
    <section aria-labelledby="sim-title" className="grid grid-cols-[minmax(0,1fr)] gap-4 rounded-2xl border bg-card p-4 animate-rise sm:p-5" key={k}>
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 id="sim-title" className="flex items-center gap-2 text-base font-semibold"><FlaskConical className="size-4 text-primary" /> E se…?</h2>
          <p className="text-xs text-muted-foreground">Mude os números e veja na hora. Nada é salvo.</p>
        </div>
        <button type="button" onClick={() => { setK((x) => x + 1); setMonthly(paceCents ?? 0); setDeadline(goal.targetDate?.slice(0, 7) ?? ""); setTarget(goal.targetCents); setRate(String(goal.annualReturnBps / 100).replace(".", ",")); }}
          className="flex h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-muted-foreground hover:bg-accent" aria-label="Voltar aos valores atuais">
          <RotateCcw className="size-3.5" /> Atual
        </button>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <span aria-hidden className="text-sm font-medium">Guardar por mês</span>
          <MoneyInput name="simMonthly" label="Guardar por mês" size="md" defaultCents={paceCents ?? 0} onChangeCents={setMonthly} />
        </div>
        <div className="grid gap-2">
          <span aria-hidden className="text-sm font-medium">Valor da meta</span>
          <MoneyInput name="simTarget" label="Valor da meta" size="md" defaultCents={goal.targetCents} onChangeCents={setTarget} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sim-deadline">Prazo</Label>
          <Input id="sim-deadline" type="month" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="h-11 text-base md:text-sm" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sim-rate">Rendimento estimado (% a.a.)</Label>
          <Input id="sim-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} className="h-11 text-base md:text-sm" />
        </div>
      </div>
      <output aria-live="polite" className="grid gap-2 rounded-xl bg-surface-2/50 p-3 text-sm sm:grid-cols-2">
        <p>
          <span className="block text-xs text-muted-foreground">Você chega em</span>
          <strong className="text-base">{sim.estimate.date ? shortMonth(sim.estimate.date) : "nunca (aporte zero)"}</strong>
          {sim.estimate.months !== null && sim.estimate.months > 0 && <span className="text-xs text-muted-foreground"> · {sim.estimate.months} meses</span>}
          <span className="mt-1 block"><PaceBadge status={sim.estimate.status} deltaMonths={sim.estimate.deltaMonths} /></span>
        </p>
        <p>
          <span className="block text-xs text-muted-foreground">Para cumprir o prazo</span>
          <strong className="text-base">
            {sim.required.kind === "no_deadline" ? "Sem prazo" : sim.required.kind === "done" ? "Já atingida" : `${money(sim.required.monthlyCents)}${sim.required.kind === "monthly" ? "/mês" : " agora"}`}
          </strong>
          {sim.required.kind === "monthly" && monthly > 0 && monthly < sim.required.monthlyCents && (
            <span className="block text-xs text-warning">Faltam {money(sim.required.monthlyCents - monthly)} por mês.</span>
          )}
        </p>
        {bps > 0 && <p className="text-xs text-muted-foreground sm:col-span-2">Com rendimento estimado de {rate}% a.a. (juros compostos). É uma estimativa, não garantia.</p>}
      </output>

      {categories.length > 0 && (
        <div className="grid gap-3 border-t pt-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Scissors className="size-4 text-primary" /> Cortar gastos para antecipar</h3>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="grid gap-1.5 text-sm font-medium">
              Categoria
              <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-11 w-full min-w-0 rounded-lg border border-input bg-surface-2/60 px-3 text-base md:text-sm">
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name} · {money(c.avgMonthlyCents)}/mês</option>)}
              </select>
            </label>
            <div role="radiogroup" aria-label="Quanto reduzir" className="flex items-end gap-1">
              {[0.1, 0.2, 0.3, 0.5].map((p) => (
                <button key={p} type="button" role="radio" aria-checked={cut === p} onClick={() => setCut(p)}
                  className={cn("h-11 rounded-xl border px-3 text-sm font-medium", cut === p && "border-primary bg-primary/10 text-primary")}>
                  {Math.round(p * 100)}%
                </button>
              ))}
            </div>
          </div>
          {cutResult && (
            <p className="text-sm" aria-live="polite">
              Reduzindo {Math.round(cut * 100)}% em <strong>{category!.name}</strong> você guarda mais {money(cutResult.extraMonthlyCents)} por mês
              {cutResult.monthsSaved !== null && cutResult.monthsSaved > 0
                ? <> e <strong>antecipa a meta em {cutResult.monthsSaved} {cutResult.monthsSaved === 1 ? "mês" : "meses"}</strong>.</>
                : cutResult.monthsAfter !== null && cutResult.monthsBefore === null
                  ? <> e passa a chegar em <strong>{cutResult.monthsAfter} meses</strong>.</>
                  : <> — não chega a antecipar um mês inteiro.</>}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">Média mensal dos gastos variáveis (sem contas fixas e parcelas) nos últimos 3 meses. Status: {PACE_LABEL[sim.estimate.status].toLowerCase()}.</p>
        </div>
      )}
    </section>
  );
}
