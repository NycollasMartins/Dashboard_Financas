"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Archive, Pause, Play, Trash2 } from "lucide-react";
import { deleteGoalAction, setGoalStatusAction } from "@/app/(app)/_actions/goals";
import { useEntrySheet } from "@/components/ledger/entry-sheet";
import { Button } from "@/components/ui/button";

/** "Guardar" no cartão: abre a folha com a meta já marcada (2 toques + valor). */
export function QuickSaveButton({ goalId, name, size = "default" }: { goalId: string; name: string; size?: "default" | "lg" }) {
  const { open } = useEntrySheet();
  return (
    <Button size={size} onClick={() => open({ mode: "goal", goalId })} aria-label={`Guardar para ${name}`}>
      <ArrowDownToLine /> Guardar
    </Button>
  );
}

export function WithdrawButton({ goalId }: { goalId: string }) {
  const { open } = useEntrySheet();
  return (
    <Button variant="outline" onClick={() => open({ mode: "goal", goalId, goalKind: "withdrawal" })}>
      <ArrowUpFromLine /> Retirar
    </Button>
  );
}

export function GoalStatusButtons({ goalId, status, canDelete }: { goalId: string; status: string; canDelete: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (next: string) =>
    start(async () => {
      const res = await setGoalStatusAction(goalId, next);
      if (res.status === "error") toast.error(res.message);
      else toast.success(res.message);
    });
  return (
    <div className="flex flex-wrap gap-2">
      {status === "active" && (
        <Button variant="outline" disabled={pending} onClick={() => run("paused")}>
          <Pause /> Pausar
        </Button>
      )}
      {(status === "paused" || status === "archived") && (
        <Button variant="outline" disabled={pending} onClick={() => run("active")}>
          <Play /> {status === "paused" ? "Retomar" : "Reabrir"}
        </Button>
      )}
      {status !== "archived" && (
        <Button variant="outline" disabled={pending} onClick={() => run("archived")}>
          <Archive /> Arquivar
        </Button>
      )}
      {canDelete && (
        <Button
          variant="ghost"
          className="text-destructive"
          disabled={pending}
          onClick={() => {
            if (!confirm("Excluir a meta e todo o histórico de aportes? Isso não pode ser desfeito. (Arquivar guarda o histórico.)")) return;
            start(async () => {
              const res = await deleteGoalAction(goalId);
              if (res.status === "error") toast.error(res.message);
              else {
                toast.success(res.message);
                router.push("/metas");
              }
            });
          }}
        >
          <Trash2 /> Excluir
        </Button>
      )}
    </div>
  );
}
