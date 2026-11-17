"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Trash2, TriangleAlert } from "lucide-react";
import { Field, FormMessage, PasswordField, SubmitButton } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { idleState } from "@/lib/action-state";
import { deleteAccountAction, requestEmailChangeAction } from "./actions";

export function EmailChangeForm({ currentEmail }: { currentEmail: string }) {
  const [state, action] = useActionState(requestEmailChangeAction, idleState);
  useEffect(() => {
    if (state.status === "success" && state.message) toast.success("Confirmação enviada para os dois e-mails.");
  }, [state]);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <p className="text-sm text-muted-foreground">
        E-mail atual: <strong className="text-foreground">{currentEmail}</strong>
      </p>
      <FormMessage state={state} />
      {state.status !== "success" && (
        <>
          <Field
            label="Novo e-mail"
            name="newEmail"
            type="email"
            inputMode="email"
            autoComplete="email"
            defaultValue={state.values?.newEmail}
            errors={state.fieldErrors?.newEmail}
          />
          <PasswordField
            label="Senha atual"
            name="password"
            autoComplete="current-password"
            errors={state.fieldErrors?.password}
          />
          <SubmitButton variant="secondary" pendingText="Enviando…" className="justify-self-start">
            Trocar e-mail
          </SubmitButton>
        </>
      )}
    </form>
  );
}

export function DeleteAccountSection({
  blockers,
}: {
  blockers: { workspace_id: string; workspace_name: string; other_members: number }[];
}) {
  const [state, action] = useActionState(deleteAccountAction, idleState);
  const blocked = blockers.length > 0;

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Apaga seu espaço individual e as famílias em que você está sozinho. Nas famílias de outras pessoas, seus
        lançamentos continuam, mas sem o seu nome. Não pode ser desfeito.
      </p>
      {blocked && (
        <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="grid gap-1">
            <p>Você é dono de família com outros membros. Antes de excluir a conta, transfira a posse ou exclua:</p>
            <ul className="list-disc pl-4">
              {blockers.map((b) => (
                <li key={b.workspace_id}>
                  <strong>{b.workspace_name}</strong> ({b.other_members}{" "}
                  {b.other_members === 1 ? "outro membro" : "outros membros"})
                </li>
              ))}
            </ul>
            <Link href="/familia" className="font-medium text-primary underline-offset-4 hover:underline">
              Ir para Família
            </Link>
          </div>
        </div>
      )}
      <Dialog>
        <DialogTrigger render={<Button variant="destructive" disabled={blocked} className="justify-self-start" />}>
          <Trash2 /> Excluir minha conta
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir sua conta?</DialogTitle>
            <DialogDescription>
              Seus dados individuais serão apagados para sempre. Confirme com sua senha e digite EXCLUIR.
            </DialogDescription>
          </DialogHeader>
          <form action={action} className="grid gap-4" noValidate>
            <FormMessage state={state} />
            <PasswordField
              label="Senha atual"
              name="password"
              autoComplete="current-password"
              errors={state.fieldErrors?.password}
            />
            <Field
              label='Digite "EXCLUIR"'
              name="confirmation"
              autoComplete="off"
              autoCapitalize="characters"
              errors={state.fieldErrors?.confirmation}
            />
            <SubmitButton variant="destructive" pendingText="Excluindo…">
              Excluir definitivamente
            </SubmitButton>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
