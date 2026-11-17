"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { saveGoalAction } from "@/app/(app)/_actions/goals";
import { Field, FormMessage, SubmitButton } from "@/components/forms/fields";
import { ColorPicker } from "@/components/ledger/card-form";
import { MoneyInput } from "@/components/ledger/money-input";
import { SelectField } from "@/components/ledger/select-field";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { idleState } from "@/lib/action-state";
import type { AccountOption } from "@/lib/data/ledger";
import { cn } from "@/lib/utils";
import { GOAL_ICONS, PRIORITY_LABEL } from "@/lib/validation/goals";
import { GOAL_ICONS_MAP } from "./goal-visuals";

export type GoalFormValue = {
  id: string;
  name: string;
  icon: string;
  color: string;
  targetCents: number;
  targetDate: string | null;
  priority: number;
  initialCents: number;
  reserveAccountId: string | null;
  annualReturnBps: number;
  notes: string | null;
};

export function GoalFormButton({
  workspaceId,
  accounts,
  goal,
  defaultOpen = false,
}: {
  workspaceId: string;
  accounts: AccountOption[];
  goal?: GoalFormValue;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {goal ? (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Pencil /> Editar
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus /> Nova meta
        </Button>
      )}
      <SheetContent title={goal ? "Editar meta" : "Nova meta"}>
        <GoalForm workspaceId={workspaceId} accounts={accounts} goal={goal} onDone={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

function GoalForm({ workspaceId, accounts, goal, onDone }: { workspaceId: string; accounts: AccountOption[]; goal?: GoalFormValue; onDone: () => void }) {
  const [state, action] = useActionState(saveGoalAction, idleState);
  const router = useRouter();
  const [icon, setIcon] = useState(goal?.icon ?? "target");
  const [priority, setPriority] = useState(String(goal?.priority ?? 2));
  useEffect(() => {
    if (state.status !== "success") return;
    toast.success(state.message);
    onDone();
    if (!goal && state.data?.id) router.push(`/metas/${state.data.id}`);
  }, [state, onDone, goal, router]);
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      {goal && <input type="hidden" name="id" value={goal.id} />}
      <input type="hidden" name="icon" value={icon} />
      <input type="hidden" name="priority" value={priority} />
      <Field label="Nome" name="name" placeholder="Ex.: Viagem para o Nordeste" maxLength={60} defaultValue={goal?.name ?? v.name} errors={e.name} />
      <MoneyInput name="targetCents" label="Quanto você quer juntar" size="md" defaultCents={goal?.targetCents ?? (Number(v.targetCents) || 0)} invalid={Boolean(e.targetCents)} />
      {e.targetCents && <p className="-mt-2 text-xs text-destructive">{e.targetCents[0]}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Prazo (opcional)" name="targetDate" type="date" defaultValue={goal?.targetDate ?? v.targetDate} errors={e.targetDate}
          hint="Sem prazo, mostramos quando você chega no ritmo atual." />
        <fieldset className="grid content-start gap-2">
          <legend className="mb-2 text-sm font-medium">Prioridade</legend>
          <div role="radiogroup" aria-label="Prioridade" className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2/60 p-1">
            {(["1", "2", "3"] as const).map((p) => (
              <button key={p} type="button" role="radio" aria-checked={priority === p} onClick={() => setPriority(p)}
                className={cn("h-10 rounded-lg text-sm font-medium text-muted-foreground", priority === p && "bg-card text-foreground shadow-sm")}>
                {PRIORITY_LABEL[Number(p) as 1 | 2 | 3]}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Ícone</legend>
        <div role="radiogroup" aria-label="Ícone" className="flex flex-wrap gap-2">
          {GOAL_ICONS.map((i) => {
            const Icon = GOAL_ICONS_MAP[i];
            return (
              <button key={i} type="button" role="radio" aria-checked={icon === i} aria-label={i} onClick={() => setIcon(i)}
                className={cn("grid size-11 place-items-center rounded-xl border bg-card", icon === i && "border-primary ring-2 ring-primary/30")}>
                <Icon className="size-5" />
              </button>
            );
          })}
        </div>
      </fieldset>
      <ColorPicker name="color" defaultValue={goal?.color ?? "#5eead4"} />
      <details className="group rounded-xl border px-3 py-2" open={Boolean(goal)}>
        <summary className="flex h-9 cursor-pointer list-none items-center text-sm font-medium [&::-webkit-details-marker]:hidden">
          Mais opções (valor já guardado, conta de reserva, rendimento)
        </summary>
        <div className="mt-3 grid gap-3">
          <MoneyInput name="initialCents" label="Já tenho guardado" size="md" defaultCents={goal?.initialCents ?? 0} />
          <p className="-mt-1 text-xs text-muted-foreground">Conta no progresso, mas não é um aporte novo (não aparece em “guardado no mês”).</p>
          <SelectField label="Conta de reserva (caixinha)" name="reserveAccountId" defaultValue={goal?.reserveAccountId ?? ""}>
            <option value="">Nenhuma — o valor fica separado na meta</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </SelectField>
          <Field label="Rendimento estimado (% ao ano)" name="annualReturnPct" inputMode="decimal" placeholder="0"
            defaultValue={goal ? String(goal.annualReturnBps / 100).replace(".", ",") : v.annualReturnPct} errors={e.annualReturnPct}
            hint="É só uma estimativa para a projeção (juros compostos). Deixe 0 se não render." />
          <Field label="Observação" name="notes" maxLength={500} defaultValue={goal?.notes ?? v.notes ?? ""} />
        </div>
      </details>
      {state.status === "error" && <FormMessage state={state} />}
      <SubmitButton size="lg" pendingText="Salvando…">{goal ? "Salvar" : "Criar meta"}</SubmitButton>
    </form>
  );
}
