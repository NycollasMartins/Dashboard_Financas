import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

/** Sino da central (alvo de 44 px) com o número de não lidas. */
export function NotificationBell({ unread, className }: { unread: number; className?: string }) {
  const label = unread ? `Notificações: ${unread} não lida${unread > 1 ? "s" : ""}` : "Notificações";
  return (
    <Link href="/notificacoes" aria-label={label} className={cn("relative grid size-11 place-items-center rounded-xl hover:bg-accent", className)}>
      <Bell className="size-5" />
      {unread > 0 && (
        <span className="absolute top-1.5 right-1.5 grid min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground" data-testid="unread-badge">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
