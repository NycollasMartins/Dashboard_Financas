"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, CalendarClock, Check, Repeat, Trash2 } from "lucide-react";
import { confirmContributionAction, deleteContributionAction, removePlanAction, savePlanAction } from "@/app/(app)/_actions/goals";
import { FormMessage, SubmitButton } from "@/components/forms/fields";
import { MoneyInput } from "@/components/ledger/money-input";
import { SelectField } from "@/components/ledger/select-field";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idleState } from "@/lib/action-state";
import type { AccountOption } from "@/lib/data/ledger";
import { cn } from "@/lib/utils";

export type HistoryItem = {
  id: string;
  amountCents: number;
  contributedOn: string;
  account: string | null;
  member: string | null;
  note: string | null;
  isPlanned: boolean;
  fromPlan: boolean;
  canEdit: boolean;
};

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (iso: string) => dateFmt.format(new Date(`${iso}T12:00:00Z`)).replace(/\./g, "");

/** Histórico completo de aportes e retiradas (previstos com botão de confirmar). */
export function GoalHistory({ items }: { items: HistoryItem[] }) {
  const [pending, start] = useTransition();
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, 12);
  const run = (fn: () => Promise<{ status: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.status === "error") toast.error(r.message);
      else toast.success(r.message);
    });
  return (
    <section aria-labelledby="hist-title" className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-2xl border bg-card p-4 animate-rise sm:p-5">
      <h2 id="hist-title" className="text-base font-semibold">Histórico</h2>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Nenhum aporte ainda. Que tal o primeiro?</p>
      ) : (
        <ul className="divide-y">
          {visible.map((c) => {
            const out = c.amountCents < 0;
            return (
              <li key={c.id} className={cn("flex min-h-14 items-center gap-3 py-2", c.isPlanned && "opacity-75")}>
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", out ? "bg-expense-muted text-expense" : "bg-savings-muted text-savings")}>
                  {out ? <ArrowUpFromLine className="size-4" /> : <ArrowDownToLine className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {out ? "Retirada" : c.isPlanned ? "Aporte previsto" : "Aporte"}
                    {c.fromPlan && <Repeat className="size-3.5 text-muted-foreground" aria-label="Do aporte planejado" />}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[fmt(c.contributedOn), c.member, c.account, c.note].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="grid justify-items-end">
                  <Money cents={c.amountCents} signed className={cn("text-sm font-semibold", out ? "text-expense" : "text-savings")} />
                  {c.isPlanned && <span className="flex items-center gap-1 text-[10px] font-semibold text-warning uppercase"><CalendarClock className="size-3" /> Previsto</span>}
                </span>
                {c.isPlanned && c.canEdit && (
                  <Button size="icon-lg" variant="outline" className="size-11" disabled={pending} aria-label="Confirmar aporte previsto"
                    onClick={() => run(() => confirmContributionAction(c.id))}>
                    <Check />
                  </Button>
                )}
                {c.canEdit && (
                  <Button size="icon-lg" variant="ghost" className="size-11 text-muted-foreground" disabled={pending} aria-label="Excluir movimento"
                    onClick={() => confirm("Excluir este movimento da meta?") && run(() => deleteContributionAction(c.id))}>
                    <Trash2 />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {items.length > 12 && (
        <button type="button" onClick={() => setShowAll((s) => !s)} className="h-11 rounded-xl text-sm font-medium text-primary hover:bg-accent">
          {showAll ? "Mostrar menos" : `Ver todos (${items.length})`}
        </button>
      )}
    </section>
  );
}

/** Aporte planejado recorrente (reutiliza recorrências: previsto → confirmar). */
export function PlanCard({
  workspaceId,
  goalId,
  plan,
  accounts,
  today,
  defaultAccountId,
}: {
  workspaceId: string;
  goalId: string;
  defaultAccountId?: string | null;
  plan: { amountCents: number; frequency: string; day: number; accountId: string | null; autoConfirm: boolean } | null;
  accounts: AccountOption[];
  today: string;
}) {
  const [wantsEdit, setWantsEdit] = useState(false);
  const [state, action] = useActionState(savePlanAction, idleState);
  const [pending, start] = useTransition();
  // Depois de salvar, volta ao resumo (derivado do estado da action, sem setState em efeito).
  const [seenAt, setSeenAt] = useState<number | undefined>(undefined);
  const justSaved = state.status === "success" && state.at !== seenAt;
  const editing = !plan || (wantsEdit && !justSaved);
  const setEditing = (v: boolean) => {
    setSeenAt(state.at);
    setWantsEdit(v);
  };
  useEffect(() => {
    if (state.status === "success") toast.success(state.message);
  }, [state]);
  const e = state.fieldErrors ?? {};
  return (
    <section aria-labelledby="plan-title" className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-2xl border bg-card p-4 animate-rise sm:p-5">
      <h2 id="plan-title" className="flex items-center gap-2 text-base font-semibold"><Repeat className="size-4 text-primary" /> Aporte planejado</h2>
      {plan && !editing ? (
        <div className="grid gap-3">
          <p className="text-sm">
            <Money cents={plan.amountCents} className="font-semibold" />{" "}
            {plan.frequency === "monthly" ? `todo dia ${plan.day}` : plan.frequency === "weekly" ? "toda semana" : "uma vez por ano"}
            {plan.autoConfirm ? " (confirmado automaticamente)" : " — aparece como previsto para você confirmar"}.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>Alterar</Button>
            <Button variant="ghost" disabled={pending} onClick={() => start(async () => {
              const r = await removePlanAction(goalId);
              if (r.status === "error") toast.error(r.message); else toast.success(r.message);
            })}>Remover</Button>
          </div>
        </div>
      ) : (
        <form action={action} className="grid gap-3" noValidate>
          <p className="text-xs text-muted-foreground">Ex.: “guardar R$ 500 todo dia 5”. Usa o mesmo mecanismo das contas fixas: aparece como previsto e você confirma.</p>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="goalId" value={goalId} />
          <input type="hidden" name="frequency" value="monthly" />
          <input type="hidden" name="startsOn" value={today} />
          <span aria-hidden className="-mb-1 text-sm font-medium">Valor por mês</span>
          <MoneyInput name="amountCents" label="Valor por mês" size="md" defaultCents={plan?.amountCents ?? 0} invalid={Boolean(e.amountCents)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="plan-day">Dia do mês</Label>
              <Input id="plan-day" name="dayOfMonth" type="number" inputMode="numeric" min={1} max={31} defaultValue={plan?.day ?? 5} className="h-11 text-base md:text-sm" />
            </div>
            <SelectField label="Sai da conta" name="accountId" defaultValue={plan?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? ""}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </SelectField>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" name="autoConfirm" defaultChecked={plan?.autoConfirm ?? false} className="size-5 accent-[var(--primary)]" />
            Confirmar automaticamente (sem precisar tocar em ✓)
          </label>
          {state.status === "error" && <FormMessage state={state} />}
          <div className="flex gap-2">
            <SubmitButton pendingText="Salvando…">Salvar plano</SubmitButton>
            {plan && <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>}
          </div>
        </form>
      )}
    </section>
  );
}
