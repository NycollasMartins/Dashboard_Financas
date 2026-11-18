"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/(app)/_actions/notifications";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NotificationItem = { id: string; title: string; body: string; url: string; createdAt: string; read: boolean };

const when = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

/** Tocar abre a tela certa (deep link) e marca como lida. */
export function NotificationList({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const unread = items.filter((i) => !i.read).length;
  return (
    <div className="grid gap-3">
      {unread > 0 && (
        <Button variant="secondary" className="justify-self-end" disabled={pending}
          onClick={() => start(async () => { await markAllNotificationsReadAction(); router.refresh(); })}>
          <CheckCheck /> Marcar todas como lidas
        </Button>
      )}
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {items.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              data-unread={!n.read || undefined}
              onClick={() => start(async () => {
                if (!n.read) await markNotificationReadAction(n.id);
                router.push(n.url);
              })}
              className="flex min-h-16 w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent"
            >
              <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} />
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm", !n.read && "font-semibold")}>{n.title}</span>
                <span className="block text-sm text-muted-foreground">{n.body}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{when(n.createdAt)}{n.read ? "" : " · não lida"}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
