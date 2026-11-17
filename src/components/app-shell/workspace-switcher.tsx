"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Home, Plus, User } from "lucide-react";
import { switchWorkspaceAction } from "@/app/(app)/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { WorkspaceSummary } from "@/lib/workspaces/context";

export function WorkspaceIcon({ kind, className }: { kind: WorkspaceSummary["kind"]; className?: string }) {
  const Icon = kind === "personal" ? User : Home;
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg",
        kind === "personal" ? "bg-primary/15 text-primary" : "bg-savings-muted text-savings",
        className,
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

export function WorkspaceSwitcher({
  workspaces,
  activeId,
  compact = false,
}: {
  workspaces: WorkspaceSummary[];
  activeId: string;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [optimisticId, setOptimisticId] = useOptimistic(activeId);
  const active = workspaces.find((w) => w.id === optimisticId) ?? workspaces[0];

  function select(id: string) {
    if (id === optimisticId) return;
    startTransition(async () => {
      setOptimisticId(id);
      const res = await switchWorkspaceAction(id);
      if (res.status === "error") toast.error(res.message);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group flex w-full items-center gap-3 rounded-xl border bg-card/60 p-2 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
          compact && "w-auto max-w-[60vw] border-transparent bg-transparent p-1.5",
          pending && "opacity-70",
        )}
      >
        <WorkspaceIcon kind={active.kind} className={compact ? "size-7" : undefined} />
        <span className="min-w-0 flex-1">
          {/* Nome acessível contém o texto visível (WCAG 2.5.3) */}
          <span className="sr-only">Trocar de espaço: </span>
          {!compact && (
            <span className="block text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {active.kind === "personal" ? "Individual" : "Família"}
            </span>
          )}
          <span className="block truncate text-sm font-medium">{active.name}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Seus espaços</DropdownMenuLabel>
          {workspaces.map((w) => (
            <DropdownMenuItem key={w.id} onClick={() => select(w.id)} className="gap-3">
              <WorkspaceIcon kind={w.kind} className="size-7" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{w.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {w.kind === "personal" ? "Individual" : w.role === "admin" ? "Família · admin" : "Família · membro"}
                </span>
              </span>
              {w.id === optimisticId && <Check className="text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/familia" />} className="gap-3">
          <span className="grid size-7 place-items-center rounded-lg border border-dashed">
            <Plus className="size-4" />
          </span>
          Criar ou gerenciar família
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
