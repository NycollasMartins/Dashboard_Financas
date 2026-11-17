"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Copy, MessageCircle, MoreHorizontal, Shield, Trash2, UserMinus, LogOut, X } from "lucide-react";
import { Field, FormMessage, SubmitButton } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { idleState, type ActionState } from "@/lib/action-state";
import {
  changeMemberRoleAction,
  createHouseholdAction,
  createInviteAction,
  deleteHouseholdAction,
  removeMemberAction,
  renameWorkspaceAction,
  revokeInviteAction,
} from "./actions";

/** Mostra toast quando uma action (chamada fora de <form>) termina. */
function useToastAction() {
  const [pending, startTransition] = useTransition();
  function run(fn: () => Promise<ActionState>) {
    startTransition(async () => {
      const res = await fn();
      if (res.status === "error") toast.error(res.message);
      else if (res.message) toast.success(res.message);
    });
  }
  return { pending, run };
}

export function CreateHouseholdForm() {
  const [state, action] = useActionState(createHouseholdAction, idleState);
  useEffect(() => {
    if (state.status === "success" && state.message) toast.success(state.message);
  }, [state]);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" noValidate>
      <Field
        label="Nome da família"
        name="name"
        placeholder="Ex.: Casa Silva"
        defaultValue={state.values?.name}
        maxLength={80}
        required
        errors={state.fieldErrors?.name}
      />
      <SubmitButton pendingText="Criando…" className="h-11">
        Criar família
      </SubmitButton>
      {state.status === "error" && (
        <div className="sm:col-span-2">
          <FormMessage state={state} />
        </div>
      )}
    </form>
  );
}

export function InviteForm({ workspaceId }: { workspaceId: string }) {
  const [state, action] = useActionState(createInviteAction, idleState);
  const [copied, setCopied] = useState(false);
  const invite = state.status === "success" ? state.data : undefined;

  async function copy() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o link manualmente.");
    }
  }

  const shareText = invite
    ? `Oi! Te convidei para nossa família no app de finanças. Entre (ou crie a conta) com o e-mail ${invite.email} e abra: ${invite.url}`
    : "";

  return (
    <div className="grid gap-4">
      <form action={action} className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end" noValidate>
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <Field
          label="E-mail da pessoa"
          name="email"
          type="email"
          inputMode="email"
          placeholder="nome@email.com"
          defaultValue={state.values?.email}
          required
          errors={state.fieldErrors?.email}
        />
        <div className="grid gap-2">
          <Label htmlFor="invite-role">Papel</Label>
          <select
            id="invite-role"
            name="role"
            defaultValue="member"
            className="h-11 rounded-lg border border-input bg-surface-2/60 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="member">Membro</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <SubmitButton pendingText="Gerando…" className="h-11">
          Gerar convite
        </SubmitButton>
      </form>

      {state.status === "error" && <FormMessage state={state} />}

      {invite && (
        <div className="grid gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 animate-rise">
          <p className="text-sm">
            Convite para <strong>{invite.email}</strong> criado. Ele vale por 7 dias e só pode ser usado uma vez,
            por quem entrar com esse e-mail.
          </p>
          <code className="block truncate rounded-lg bg-background/60 px-3 py-2 font-mono text-xs">{invite.url}</code>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={copy}>
              {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar link"}
            </Button>
            <Button
              variant="secondary"
              nativeButton={false}
              render={
                <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" />
              }
            >
              <MessageCircle /> Enviar pelo WhatsApp
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function RevokeInviteButton({ inviteId }: { inviteId: string }) {
  const { pending, run } = useToastAction();
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      onClick={() => run(() => revokeInviteAction(inviteId))}
      aria-label="Revogar convite"
    >
      <X />
    </Button>
  );
}

export function MemberActions({
  workspaceId,
  userId,
  role,
  isSelf,
  canManage,
}: {
  workspaceId: string;
  userId: string;
  role: "admin" | "member";
  isSelf: boolean;
  canManage: boolean;
}) {
  const { pending, run } = useToastAction();

  if (isSelf) {
    return (
      <ConfirmDialog
        trigger={
          <Button variant="ghost" size="sm" disabled={pending}>
            <LogOut /> Sair
          </Button>
        }
        title="Sair da família?"
        description="Você deixa de ver os dados desta família. Para voltar, um admin precisa te convidar de novo."
        confirmLabel="Sair da família"
        onConfirm={() => run(() => removeMemberAction(workspaceId, userId))}
      />
    );
  }
  if (!canManage) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" disabled={pending} aria-label="Ações do membro" />}
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          onClick={() => run(() => changeMemberRoleAction(workspaceId, userId, role === "admin" ? "member" : "admin"))}
        >
          <Shield /> {role === "admin" ? "Tornar membro" : "Tornar admin"}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => run(() => removeMemberAction(workspaceId, userId))}>
          <UserMinus /> Remover da família
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RenameWorkspaceForm({ workspaceId, name }: { workspaceId: string; name: string }) {
  const [state, action] = useActionState(renameWorkspaceAction, idleState);
  useEffect(() => {
    if (state.status === "success" && state.message) toast.success(state.message);
  }, [state]);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" noValidate>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <Field label="Nome" name="name" defaultValue={name} maxLength={80} required errors={state.fieldErrors?.name} />
      <SubmitButton variant="secondary" pendingText="Salvando…" className="h-11">
        Salvar
      </SubmitButton>
      {state.status === "error" && (
        <div className="sm:col-span-2">
          <FormMessage state={state} />
        </div>
      )}
    </form>
  );
}

export function DeleteHouseholdButton({ workspaceId, name }: { workspaceId: string; name: string }) {
  const { pending, run } = useToastAction();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" disabled={pending}>
          <Trash2 /> Excluir família
        </Button>
      }
      title={`Excluir “${name}”?`}
      description="Todos os lançamentos, cartões, metas e categorias desta família serão apagados para todos os membros. Isso não pode ser desfeito."
      confirmLabel="Excluir definitivamente"
      destructive
      onConfirm={() => run(() => deleteHouseholdAction(workspaceId))}
    />
  );
}

function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
}: {
  trigger: React.ReactElement;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Cancelar</DialogClose>
          <DialogClose
            render={<Button variant={destructive ? "destructive" : "default"} />}
            onClick={onConfirm}
          >
            {confirmLabel}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
