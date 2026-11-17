"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Archive, Pencil, Plus } from "lucide-react";
import { archiveAccountAction, saveAccountAction } from "@/app/(app)/_actions/ledger";
import { Field, FormMessage, SubmitButton } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { idleState } from "@/lib/action-state";
import type { AccountOption } from "@/lib/data/ledger";
import { ACCOUNT_TYPE_LABELS } from "@/lib/validation/ledger";
import { ColorPicker } from "./card-form";
import { SelectField } from "./entry-sheet";
import { MoneyInput } from "./money-input";

export function AccountFormButton({ workspaceId, account }: { workspaceId: string; account?: AccountOption }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {account ? (
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label={`Editar ${account.name}`}>
          <Pencil />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus /> Nova conta
        </Button>
      )}
      {open && (
        <SheetContent title={account ? "Editar conta" : "Nova conta"}>
          <AccountForm workspaceId={workspaceId} account={account} onDone={() => setOpen(false)} />
        </SheetContent>
      )}
    </Sheet>
  );
}

function AccountForm({ workspaceId, account, onDone }: { workspaceId: string; account?: AccountOption; onDone: () => void }) {
  const [state, action] = useActionState(saveAccountAction, idleState);
  const [archiving, start] = useTransition();
  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      {account && <input type="hidden" name="id" value={account.id} />}
      <Field label="Nome" name="name" placeholder="Ex.: Nubank, Carteira" defaultValue={account?.name ?? state.values?.name} maxLength={60} errors={e.name} />
      <SelectField label="Tipo" name="type" defaultValue={account?.type ?? "checking"}>
        {Object.entries(ACCOUNT_TYPE_LABELS).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </SelectField>
      <div className="grid gap-2">
        <span className="text-sm font-medium">Saldo inicial</span>
        <MoneyInput name="initialBalanceCents" label="Saldo inicial" size="md" defaultCents={account?.initialBalanceCents ?? 0} />
        <p className="text-xs text-muted-foreground">
          O saldo atual é sempre calculado: saldo inicial + receitas − despesas pagas ± transferências − pagamentos de fatura.
        </p>
      </div>
      <ColorPicker name="color" defaultValue={account?.color ?? "#5eead4"} />
      {state.status === "error" && <FormMessage state={state} />}
      <div className="flex gap-2">
        {account && (
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={archiving}
            onClick={() =>
              start(async () => {
                const r = await archiveAccountAction(account.id);
                if (r.status === "error") toast.error(r.message);
                else {
                  toast.success(r.message);
                  onDone();
                }
              })
            }
          >
            <Archive /> Arquivar
          </Button>
        )}
        <SubmitButton size="lg" pendingText="Salvando…" className="flex-1">Salvar</SubmitButton>
      </div>
    </form>
  );
}
