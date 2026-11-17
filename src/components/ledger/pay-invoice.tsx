"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Banknote, Trash2 } from "lucide-react";
import { deleteInvoicePaymentAction, payInvoiceAction } from "@/app/(app)/_actions/ledger";
import { FormMessage, SubmitButton } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { idleState } from "@/lib/action-state";
import type { AccountOption } from "@/lib/data/ledger";
import { SelectField } from "./entry-sheet";
import { MoneyInput } from "./money-input";

export function PayInvoiceButton({
  workspaceId,
  invoiceId,
  remainingCents,
  accounts,
  today,
}: {
  workspaceId: string;
  invoiceId: string;
  remainingCents: number;
  accounts: AccountOption[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} disabled={remainingCents <= 0}>
        <Banknote /> Registrar pagamento
      </Button>
      {open && (
        <SheetContent
          title="Pagar fatura"
          description="O pagamento sai da conta escolhida. Ele não é uma nova despesa: as compras já foram contadas quando você as lançou."
        >
          <PayForm workspaceId={workspaceId} invoiceId={invoiceId} remainingCents={remainingCents} accounts={accounts} today={today} onDone={() => setOpen(false)} />
        </SheetContent>
      )}
    </Sheet>
  );
}

function PayForm({
  workspaceId,
  invoiceId,
  remainingCents,
  accounts,
  today,
  onDone,
}: {
  workspaceId: string;
  invoiceId: string;
  remainingCents: number;
  accounts: AccountOption[];
  today: string;
  onDone: () => void;
}) {
  const [state, action] = useActionState(payInvoiceAction, idleState);
  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <MoneyInput name="amountCents" label="Valor pago" defaultCents={remainingCents} invalid={Boolean(state.fieldErrors?.amountCents)} />
      <SelectField label="Pago com a conta" name="accountId" defaultValue={accounts[0]?.id ?? ""}>
        <option value="">Sem conta (não altera saldos)</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </SelectField>
      <div className="grid gap-2">
        <Label htmlFor="paidOn">Data do pagamento</Label>
        <Input id="paidOn" name="paidOn" type="date" defaultValue={today} />
      </div>
      {state.status === "error" && <FormMessage state={state} />}
      <SubmitButton size="lg" pendingText="Registrando…">Confirmar pagamento</SubmitButton>
    </form>
  );
}

export function DeletePaymentButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      aria-label="Excluir pagamento"
      onClick={() =>
        start(async () => {
          const res = await deleteInvoicePaymentAction(id);
          if (res.status === "error") toast.error(res.message);
          else toast.success(res.message);
        })
      }
    >
      <Trash2 />
    </Button>
  );
}
