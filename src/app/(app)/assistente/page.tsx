import type { Metadata } from "next";
import { Suspense } from "react";
import { AssistantChat } from "@/components/assistant/chat";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChatMessage } from "@/app/(app)/_actions/assistant";
import type { ChatReply } from "@/lib/assistant/server/engine";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspaces/context";

export const metadata: Metadata = { title: "Assistente" };

export default function AssistantPage() {
  return (
    <>
      <PageHeader title="Assistente" description="Registre e consulte por mensagem, do jeito que você fala." className="mb-3 lg:mb-4" />
      <Suspense fallback={<div className="grid gap-3" aria-busy="true"><Skeleton className="h-12 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>}>
        <Chat />
      </Suspense>
    </>
  );
}

async function Chat() {
  const user = await requireUser();
  await getWorkspaceContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("assistant_messages")
    .select("id, role, body, payload, created_at")
    .eq("user_id", user.id)
    .eq("channel", "app")
    .order("created_at", { ascending: false })
    .limit(60);
  const initial: ChatMessage[] = (data ?? []).reverse().map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    body: m.body,
    reply: (m.payload as ChatReply | null) ?? undefined,
    createdAt: m.created_at,
  }));
  const aiConfigured = Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY) && process.env.ASSISTANT_AI_ENABLED !== "false";
  return <AssistantChat initial={initial} aiConfigured={aiConfigured} />;
}
