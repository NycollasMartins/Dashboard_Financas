"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { useEntrySheet } from "@/components/ledger/entry-sheet";
import { cn } from "@/lib/utils";
import { MOBILE_NAV, MORE_ITEMS, NAV_ITEMS } from "./nav-config";

function isActive(pathname: string, href: string) {
  if (href === "/mais") return pathname === "/mais" || MORE_ITEMS.some((i) => pathname.startsWith(i.href));
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();
  return (
    // Em telas baixas (notebook 720 px) só o menu rola; o "Novo lançamento" e o usuário ficam sempre visíveis.
    <nav aria-label="Principal" className="-mx-1 grid min-h-0 flex-1 content-start gap-1 overflow-y-auto px-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon, comingInPhase }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
              active && "bg-sidebar-accent text-foreground",
            )}
          >
            {active && (
              <span aria-hidden className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-primary" />
            )}
            <Icon className={cn("size-[18px]", active && "text-primary")} />
            <span className="flex-1">{label}</span>
            {comingInPhase && (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                em breve
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const [a, b, c, d] = MOBILE_NAV;
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-safe lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
        {[a, b].map((item) => (
          <MobileItem key={item.href} {...item} active={isActive(pathname, item.href)} />
        ))}
        <div className="grid place-items-center">
          <QuickAddButton />
        </div>
        {[c, d].map((item) => (
          <MobileItem key={item.href} {...item} active={isActive(pathname, item.href)} />
        ))}
      </div>
    </nav>
  );
}

function MobileItem({
  href,
  label,
  icon: Icon,
  active,
}: (typeof MOBILE_NAV)[number] & { active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors",
        active && "text-primary",
      )}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}

/** Botão "+" de lançamento rápido (3 toques: + → valor → categoria → Salvar). Atalho: tecla N. */
export function QuickAddButton({ className }: { className?: string }) {
  const { open } = useEntrySheet();
  return (
    <button
      type="button"
      onClick={() => open()}
      aria-label="Novo lançamento"
      aria-keyshortcuts="N"
      className={cn(
        "grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_10px_30px_-10px_var(--primary)] transition-transform active:scale-95",
        className,
      )}
    >
      <Plus className="size-6" strokeWidth={2.5} />
    </button>
  );
}
