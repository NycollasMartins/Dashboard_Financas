"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { deleteRecurrenceAction, saveRecurrenceAction, toggleRecurrenceAction } from "@/app/(app)/_actions/ledger";
import { Field, FormMessage, SubmitButton } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { idleState } from "@/lib/action-state";
import type { LedgerLookups } from "@/lib/data/ledger";
import { cn } from "@/lib/utils";
import { PAYMENT_LABELS } from "@/lib/validation/ledger";
import { SelectField } from "./entry-sheet";
import { MoneyInput } from "./money-input";

export type RecurrenceRow = {
  id: string;
  kind: "income" | "expense";
  description: string;
  amount_cents: number;
  payment_method: string;
  account_id: string | null;
  card_id: string | null;
  member_user_id: string | null;
  frequency: "weekly" | "monthly" | "yearly";
  day_of_month: number;
  starts_on: string;
  ends_on: string | null;
  is_active: boolean;
  auto_confirm: boolean;
  category_id: string | null;
};

export function RecurrenceFormButton({
  workspaceId,
  lookups,
  today,
  recurrence,
}: {
  workspaceId: string;
  lookups: LedgerLookups;
  today: string;
  recurrence?: RecurrenceRow;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {recurrence ? (
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label={`Editar ${recurrence.description}`}>
          <Pencil />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus /> Nova recorrência
        </Button>
      )}
      {open && (
        <SheetContent title={recurrence ? "Editar recorrência" : "Nova recorrência"}>
          <RecurrenceForm workspaceId={workspaceId} lookups={lookups} today={today} recurrence={recurrence} onDone={() => setOpen(false)} />
        </SheetContent>
      )}
    </Sheet>
  );
}

function RecurrenceForm({
  workspaceId,
  lookups,
  today,
  recurrence: r,
  onDone,
}: {
  workspaceId: string;
  lookups: LedgerLookups;
  today: string;
  recurrence?: RecurrenceRow;
  onDone: () => void;
}) {
  const [state, action] = useActionState(saveRecurrenceAction, idleState);
  const [kind, setKind] = useState<"expense" | "income">(r?.kind ?? "expense");
  const [method, setMethod] = useState(r?.payment_method ?? "pix");
  const [frequency, setFrequency] = useState(r?.frequency ?? "monthly");
  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);
  const e = state.fieldErrors ?? {};
  const methods = kind === "income" ? (["pix", "transfer", "cash", "other"] as const) : (["pix", "boleto", "debit", "credit", "cash", "other"] as const);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      {r && <input type="hidden" name="id" value={r.id} />}
      <input type="hidden" name="kind" value={kind} />
      <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2/60 p-1">
        {(["expense", "income"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={cn("h-11 rounded-xl text-sm font-medium text-muted-foreground", kind === k && "bg-card text-foreground shadow-sm")}
          >
            {k === "expense" ? "Despesa fixa" : "Receita fixa"}
          </button>
        ))}
      </div>
      <Field label="Descrição" name="description" placeholder={kind === "income" ? "Ex.: Salário" : "Ex.: Aluguel"} defaultValue={r?.description ?? state.values?.description} maxLength={140} errors={e.description} />
      <div className="grid gap-2">
        <span className="text-sm font-medium">Valor</span>
        <MoneyInput name="amountCents" label="Valor" size="md" defaultCents={r?.amount_cents ?? 0} invalid={Boolean(e.amountCents)} />
        {e.amountCents && <p className="text-xs text-destructive">{e.amountCents[0]}</p>}
      </div>
      <SelectField label="Categoria" name="categoryId" defaultValue={r?.category_id ?? ""}>
        <option value="">Sem categoria</option>
        {lookups.categories.filter((c) => c.kind === kind && !c.archived).map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </SelectField>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Frequência" name="frequency" value={frequency} onChange={(ev) => setFrequency(ev.target.value as typeof frequency)}>
          <option value="monthly">Mensal</option>
          <option value="weekly">Semanal</option>
          <option value="yearly">Anual</option>
        </SelectField>
        {frequency === "weekly" ? (
          <input type="hidden" name="dayOfMonth" value="1" />
        ) : (
          <Field label="Dia" name="dayOfMonth" type="number" inputMode="numeric" min={1} max={31} defaultValue={r?.day_of_month ?? 5} errors={e.dayOfMonth} hint="31 = último dia" />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Começa em" name="startsOn" type="date" defaultValue={r?.starts_on ?? today} errors={e.startsOn} hint={frequency === "weekly" ? "Repete neste dia da semana" : frequency === "yearly" ? "Repete neste mês" : undefined} />
        <Field label="Termina em" name="endsOn" type="date" defaultValue={r?.ends_on ?? ""} errors={e.endsOn} hint="Opcional" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Forma" name="paymentMethod" value={method} onChange={(ev) => setMethod(ev.target.value)} errors={e.paymentMethod}>
          {methods.map((m) => (
            <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>
          ))}
        </SelectField>
        {method === "credit" ? (
          <SelectField label="Cartão" name="cardId" defaultValue={r?.card_id ?? lookups.cards[0]?.id ?? ""} errors={e.cardId}>
            {lookups.cards.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </SelectField>
        ) : (
          <SelectField label="Conta" name="accountId" defaultValue={r?.account_id ?? lookups.accounts[0]?.id ?? ""}>
            <option value="">Sem conta</option>
            {lookups.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </SelectField>
        )}
      </div>
      {lookups.members.length > 1 && (
        <SelectField label={kind === "income" ? "De quem é" : "Responsável"} name="memberUserId" defaultValue={r?.member_user_id ?? ""}>
          <option value="">Não informar</option>
          {lookups.members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </SelectField>
      )}
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input type="checkbox" name="autoConfirm" defaultChecked={r?.auto_confirm ?? method === "credit"} className="mt-0.5 size-5 accent-[var(--primary)]" />
        <span>
          Já entra como pago/recebido
          <span className="block text-xs text-muted-foreground">Desmarcado: aparece como &ldquo;previsto&rdquo; até você confirmar.</span>
        </span>
      </label>
      {r && (
        <label className="flex min-h-11 items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
          <input type="checkbox" name="applyToFuture" defaultChecked className="mt-0.5 size-5 accent-[var(--primary)]" />
          <span>
            Aplicar também aos lançamentos previstos a partir de hoje
            <span className="block text-xs text-muted-foreground">Os já confirmados e os do passado nunca mudam.</span>
          </span>
        </label>
      )}
      {state.status === "error" && <FormMessage state={state} />}
      <SubmitButton size="lg" pendingText="Salvando…">{r ? "Salvar" : "Criar recorrência"}</SubmitButton>
    </form>
  );
}

export function RecurrenceActions({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const run = (fn: () => Promise<{ status: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.status === "error") toast.error(r.message);
      else toast.success(r.message);
      setConfirming(false);
    });
  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="destructive" disabled={pending} onClick={() => run(() => deleteRecurrenceAction(id, true))}>
          Excluir e apagar previstos
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
      </div>
    );
  }
  return (
    <div className="flex">
      <Button variant="ghost" size="icon" disabled={pending} aria-label={active ? "Pausar" : "Reativar"} onClick={() => run(() => toggleRecurrenceAction(id, !active))}>
        {active ? <Pause /> : <Play />}
      </Button>
      <Button variant="ghost" size="icon" disabled={pending} aria-label="Excluir" onClick={() => setConfirming(true)}>
        <Trash2 />
      </Button>
    </div>
  );
}
