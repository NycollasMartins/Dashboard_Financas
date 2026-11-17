"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/forms/fields";
import { idleState } from "@/lib/action-state";
import { acceptInviteAction } from "../actions";

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInviteAction, idleState);
  return (
    <form action={action} className="grid gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <SubmitButton size="lg" pendingText="Entrando na família…" className="w-full">
        Aceitar convite
      </SubmitButton>
    </form>
  );
}
