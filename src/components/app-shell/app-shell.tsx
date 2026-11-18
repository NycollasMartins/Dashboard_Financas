import Link from "next/link";
import { Logo, LogoMark } from "@/components/brand/logo";
import { EntrySheetProvider } from "@/components/ledger/entry-sheet";
import { Celebration } from "@/components/goals/celebration";
import { NotificationBell } from "@/components/notifications/bell";
import { PrivacyProvider, PrivacyToggle } from "@/components/privacy/privacy";
import { getLedgerLookups } from "@/lib/data/ledger";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";
import { getWorkspaceContext } from "@/lib/workspaces/context";
import { MobileBottomNav, QuickAddButton, SidebarNav } from "./nav";
import { UserMenu } from "./user-menu";
import { WorkspaceSwitcher } from "./workspace-switcher";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const { user, workspaces, active } = await getWorkspaceContext();
  const supabase = await createClient();
  const [lookups, unreadRes] = await Promise.all([
    getLedgerLookups(active.id, user.id),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  const unread = unreadRes.count ?? 0;

  return (
    <PrivacyProvider initialHidden={user.hideAmounts}>
    <EntrySheetProvider workspaceId={active.id} lookups={lookups} today={todayISO()}>
    <div className="relative min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      {/* Brilho de fundo sutil */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,var(--glow-1),transparent)]" />

      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r bg-sidebar/80 p-4 backdrop-blur lg:flex">
        <div className="flex items-center justify-between gap-2 px-2 pt-1">
          <Link href="/painel">
            <Logo />
          </Link>
          <NotificationBell unread={unread} />
        </div>
        <WorkspaceSwitcher workspaces={workspaces} activeId={active.id} />
        <SidebarNav />
        <div className="grid shrink-0 gap-3">
          <div className="flex items-center justify-between rounded-xl border border-dashed p-3">
            <span className="text-xs text-muted-foreground">
              Novo lançamento <kbd className="ml-1 rounded border px-1 font-mono text-[10px]">N</kbd>
            </span>
            <QuickAddButton className="size-9 rounded-xl" />
          </div>
          <UserMenu name={user.fullName} email={user.email} showDetails />
        </div>
      </aside>

      {/* Topo (celular) */}
      <header className="glass pt-safe sticky top-0 z-40 border-b lg:hidden">
        <div className="flex h-14 items-center justify-between gap-2 px-3">
        <Link href="/painel" aria-label="Início">
          <LogoMark className="size-7" />
        </Link>
        <WorkspaceSwitcher workspaces={workspaces} activeId={active.id} compact />
        <div className="flex items-center">
          <NotificationBell unread={unread} />
          <PrivacyToggle />
          <UserMenu name={user.fullName} email={user.email} />
        </div>
        </div>
      </header>

      <main id="conteudo" className="mx-auto w-full max-w-6xl px-4 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
        {children}
      </main>

      <MobileBottomNav />
      <Celebration />
    </div>
    </EntrySheetProvider>
    </PrivacyProvider>
  );
}

export function AppShellSkeleton() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="hidden border-r bg-sidebar/80 p-4 lg:block">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-muted" />
        <div className="mt-6 h-14 animate-pulse rounded-xl bg-muted" />
      </aside>
      <div className="h-14 border-b lg:hidden" />
      <main className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </main>
    </div>
  );
}
