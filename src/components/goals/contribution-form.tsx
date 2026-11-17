"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, Loader2 } from "lucide-react";
import { saveContributionAction } from "@/app/(app)/_actions/goals";
import { FormMessage } from "@/components/forms/fields";
import { MoneyInput } from "@/components/ledger/money-input";
import { SelectField } from "@/components/ledger/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idleState } from "@/lib/action-state";
import type { LedgerLookups } from "@/lib/data/ledger";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import { celebrateGoal } from "./celebration";
import { GoalIcon } from "./goal-visuals";

/*
 * Guardar para meta (aporte) ou retirar (com motivo). 3 toques:
 *   + → "Guardar para meta" → digita o valor → Salvar   (meta usada por último já vem marcada)
 *   ou, no cartão da meta: "Guardar" → valor → Salvar.
 */
export function ContributionForm({
  workspaceId,
  lookups,
  today,
  goalId,
  initialKind = "deposit",
  onDone,
}: {
  workspaceId: string;
  lookups: LedgerLookups;
  today: string;
  goalId?: string;
  initialKind?: "deposit" | "withdrawal";
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveContributionAction, idleState);
  const goals = lookups.goals.filter((g) => g.status !== "archived");
  const [kind, setKind] = useState<"deposit" | "withdrawal">(initialKind);
  const [selected, setSelected] = useState(goalId ?? goals[0]?.id ?? "");
  const [amount, setAmount] = useState(0);
  const [more, setMore] = useState(false);
  const goal = goals.find((g) => g.id === selected);
  const defaultAccount = goal?.planAccountId ?? lookups.defaults.accountId ?? lookups.accounts.find((a) => a.id !== goal?.reserveAccountId)?.id ?? "";
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status !== "success") return;
    if (state.data?.achievedNow) celebrateGoal(state.data.goal.name);
    else toast.success(state.message);
    onDone();
  }, [state, onDone]);

  if (goals.length === 0) {
    return (
      <div className="grid gap-3 px-5 pb-6 text-sm text-muted-foreground">
        <p>Você ainda não tem metas neste espaço.</p>
        <Button render={<Link href="/metas?nova=1" />} size="lg">Criar minha primeira meta</Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex min-h-0 flex-1 flex-col" noValidate>
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto overscroll-contain px-5 pb-4">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="goalId" value={selected} />

        <div role="radiogroup" aria-label="Tipo de movimento" className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2/60 p-1">
          {([
            ["deposit", "Guardar", ArrowDownToLine],
            ["withdrawal", "Retirar", ArrowUpFromLine],
          ] as const).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={kind === v}
              onClick={() => setKind(v)}
              className={cn(
                "flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-medium text-muted-foreground",
                kind === v && "bg-card text-foreground shadow-sm",
                kind === v && v === "deposit" && "text-savings",
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>

        <MoneyInput name="amountCents" label="Valor" autoFocus invalid={Boolean(errors.amountCents)} onChangeCents={setAmount} />
        {errors.amountCents && <p className="-mt-2 text-center text-xs text-destructive">{errors.amountCents[0]}</p>}

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Meta</legend>
          <div role="radiogroup" aria-label="Meta" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {goals.map((g) => {
              const pct = g.targetCents ? Math.min(1, g.savedCents / g.targetCents) : 0;
              return (
                <button
                  key={g.id}
                  type="button"
                  role="radio"
                  aria-checked={selected === g.id}
                  onClick={() => setSelected(g.id)}
                  className={cn(
                    "grid min-h-16 gap-1 rounded-xl border bg-card px-3 py-2 text-left transition-colors hover:bg-accent/60",
                    selected === g.id && "border-primary ring-2 ring-primary/30",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <GoalIcon icon={g.icon} color={g.color} className="size-4 shrink-0" />
                    <span className="truncate text-sm font-medium">{g.name}</span>
                  </span>
                  <span aria-hidden className="block h-1 overflow-hidden rounded-full bg-surface-2">
                    <span className="block h-full rounded-full" style={{ width: `${pct * 100}%`, background: g.color }} />
                  </span>
                  <span className="text-[11px] text-muted-foreground">{Math.round(pct * 100)}%</span>
                </button>
              );
            })}
          </div>
          {errors.goalId && <p className="text-xs text-destructive">{errors.goalId[0]}</p>}
        </fieldset>

        {kind === "withdrawal" && (
          <div className="grid gap-2">
            <Label htmlFor="contrib-note">Motivo da retirada</Label>
            <Input id="contrib-note" name="note" required maxLength={200} placeholder="Ex.: conserto do carro" aria-invalid={Boolean(errors.note)} />
            {errors.note && <p className="text-xs text-destructive">{errors.note[0]}</p>}
            {goal && amount > goal.savedCents && (
              <p className="text-xs text-warning">A meta tem {formatBRL(goal.savedCents)} guardados.</p>
            )}
          </div>
        )}

        <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more}
          className="flex h-11 items-center justify-between rounded-xl px-1 text-sm font-medium text-muted-foreground">
          Mais opções <ChevronDown className={cn("size-4 transition-transform", more && "rotate-180")} />
        </button>
        <div className={cn("grid gap-3 sm:grid-cols-2", !more && "hidden")}>
          <SelectField label={kind === "deposit" ? "Sai da conta" : "Volta para a conta"} name="accountId" defaultValue={defaultAccount} key={`acc-${selected}`}>
            <option value="">Nenhuma (só registrar)</option>
            {lookups.accounts.filter((a) => a.id !== goal?.reserveAccountId).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </SelectField>
          <div className="grid gap-2">
            <Label htmlFor="contrib-date">Data</Label>
            <Input id="contrib-date" type="date" name="contributedOn" defaultValue={today} className="h-11 text-base md:text-sm" />
          </div>
          {lookups.members.length > 1 && (
            <SelectField label="Quem guardou" name="memberUserId" defaultValue="">
              <option value="">Eu</option>
              {lookups.members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </SelectField>
          )}
          {kind === "deposit" && (
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="contrib-note2">Observação</Label>
              <Input id="contrib-note2" name="note" maxLength={200} placeholder="Opcional" />
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Guardar <strong>não é despesa</strong>: o valor sai da conta escolhida e vai para a meta
          {goal?.reserveAccountId ? " (conta de reserva)" : " (caixinha)"}.
        </p>
        {state.status === "error" && <FormMessage state={state} />}
      </div>
      <div className="flex shrink-0 gap-2 border-t bg-popover px-5 pt-3 pb-4">
        <Button type="submit" size="lg" className="flex-1" disabled={pending || amount <= 0 || !selected}>
          {pending && <Loader2 className="animate-spin" />}
          {kind === "deposit" ? "Guardar" : "Registrar retirada"}
        </Button>
      </div>
    </form>
  );
}
