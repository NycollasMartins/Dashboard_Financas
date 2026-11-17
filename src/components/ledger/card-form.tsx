"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { saveCardAction } from "@/app/(app)/_actions/ledger";
import { Field, FormMessage, SubmitButton } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { idleState } from "@/lib/action-state";
import type { CardOption } from "@/lib/data/ledger";
import { cn } from "@/lib/utils";
import { MoneyInput } from "./money-input";

export const SWATCHES = ["#8b5cf6", "#5eead4", "#f472b6", "#fb923c", "#facc15", "#60a5fa", "#4ade80", "#f87171", "#94a3b8"];

export function ColorPicker({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [color, setColor] = useState(defaultValue);
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">Cor</legend>
      <input type="hidden" name={name} value={color} />
      <div role="radiogroup" aria-label="Cor" className="flex flex-wrap gap-2">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={c}
            onClick={() => setColor(c)}
            className={cn("size-11 rounded-full border-2 border-transparent", color === c && "border-foreground")}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </fieldset>
  );
}

export function CardFormButton({ workspaceId, card }: { workspaceId: string; card?: CardOption }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {card ? (
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label={`Editar ${card.name}`}>
          <Pencil />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus /> Novo cartão
        </Button>
      )}
      {open && (
        <SheetContent title={card ? "Editar cartão" : "Novo cartão"}>
          <CardForm workspaceId={workspaceId} card={card} onDone={() => setOpen(false)} />
        </SheetContent>
      )}
    </Sheet>
  );
}

function CardForm({ workspaceId, card, onDone }: { workspaceId: string; card?: CardOption; onDone: () => void }) {
  const [state, action] = useActionState(saveCardAction, idleState);
  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      {card && <input type="hidden" name="id" value={card.id} />}
      <Field label="Nome" name="name" placeholder="Ex.: Nubank" defaultValue={card?.name ?? v.name} maxLength={40} errors={e.name} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bandeira/emissor" name="brand" placeholder="Opcional" defaultValue={card?.brand ?? v.brand} maxLength={30} />
        <Field label="Final" name="last4" placeholder="1234" inputMode="numeric" maxLength={4} defaultValue={card?.last4 ?? v.last4} errors={e.last4} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dia do fechamento" name="closingDay" type="number" inputMode="numeric" min={1} max={31} defaultValue={card?.closingDay ?? v.closingDay ?? 3} errors={e.closingDay} />
        <Field label="Dia do vencimento" name="dueDay" type="number" inputMode="numeric" min={1} max={31} defaultValue={card?.dueDay ?? v.dueDay ?? 10} errors={e.dueDay} />
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Compras no dia do fechamento ou depois vão para a fatura seguinte. Dias 29–31 viram o último dia em meses curtos.
      </p>
      <div className="grid gap-2">
        <span className="text-sm font-medium">Limite (opcional)</span>
        <MoneyInput name="limitCents" label="Limite" size="md" defaultCents={card?.limitCents ?? 0} />
      </div>
      <ColorPicker name="color" defaultValue={card?.color ?? "#8b5cf6"} />
      {state.status === "error" && <FormMessage state={state} />}
      <SubmitButton size="lg" pendingText="Salvando…">{card ? "Salvar" : "Cadastrar cartão"}</SubmitButton>
    </form>
  );
}
