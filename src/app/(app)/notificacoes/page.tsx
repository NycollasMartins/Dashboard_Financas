import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BellOff, Settings } from "lucide-react";
import { NotificationList } from "@/components/notifications/notification-list";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notificações" };

async function Content() {
  const supabase = await createClient();
  const { data } = await supabase.from("notifications")
    .select("id, title, body, url, created_at, read_at").order("created_at", { ascending: false }).limit(100);
  const items = (data ?? []).map((n) => ({ id: n.id, title: n.title, body: n.body, url: n.url, createdAt: n.created_at, read: Boolean(n.read_at) }));
  if (!items.length) {
    return (
      <div className="grid place-items-center gap-2 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        <BellOff className="size-6" />
        Nenhuma notificação ainda. Contas vencendo, faturas e metas aparecem aqui.
      </div>
    );
  }
  return <NotificationList items={items} />;
}

export default function NotificationsPage() {
  return (
    <>
      <PageHeader
        title="Notificações"
        description="Avisos de contas, faturas, metas e resumo semanal."
        actions={<Link href="/configuracoes/notificacoes" className={buttonVariants({ variant: "secondary" })}><Settings /> Preferências</Link>}
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:max-w-3xl">
        <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
          <Content />
        </Suspense>
      </div>
    </>
  );
}
