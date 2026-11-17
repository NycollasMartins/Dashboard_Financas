import { Suspense } from "react";
import { AppShell, AppShellSkeleton } from "@/components/app-shell/app-shell";

/**
 * Tudo dentro de (app) depende da sessão (cookies) → renderizado por requisição.
 * Com Cache Components, acesso a cookies precisa ficar dentro de <Suspense>.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
