import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { serverEnv, serverEnvStatus } from "@/lib/env.server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspaces/context";
import { TelegramPanel } from "./telegram-panel";

export const metadata: Metadata = { title: "Canais" };

async function Content() {
  const { workspaces } = await getWorkspaceContext();
  const supabase = await createClient();
  const { data: link } = await supabase.from("channel_links")
    .select("display_label, default_workspace_id, verified_at").eq("channel", "telegram").maybeSingle();
  return (
    <TelegramPanel
      botUsername={serverEnv.TELEGRAM_BOT_USERNAME}
      botProblems={(["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET", "SUPABASE_SECRET_KEY"] as const)
        .filter((n) => serverEnvStatus[n] !== "ok")
        .map((n) => `${n} (${serverEnvStatus[n]})`)}
      link={link ? { label: link.display_label, workspaceId: link.default_workspace_id, since: link.verified_at } : null}
      workspaces={workspaces.map((w) => ({ id: w.id, name: w.kind === "personal" ? "Individual" : w.name }))}
    />
  );
}

export default function ChannelsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Configurações"
        title="Canais"
        description="Lance gastos pelo Telegram: texto, foto de cupom ou áudio. O bot só responde a chats vinculados à sua conta."
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:max-w-2xl">
        <Suspense fallback={<Skeleton className="h-72 rounded-2xl" />}>
          <Content />
        </Suspense>
      </div>
    </>
  );
}
