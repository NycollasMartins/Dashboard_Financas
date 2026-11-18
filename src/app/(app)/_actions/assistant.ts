"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { handleAssistant, type ChatInput, type ChatReply } from "@/lib/assistant/server/engine";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspaces/context";

/*
 * Canal "app" do assistente: só traduz a tela ↔ motor de conversa
 * (src/lib/assistant/server/engine.ts). O WhatsApp/Telegram (Fase 6) terão
 * adaptadores equivalentes, sem duplicar regra.
 */

const inputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string().trim().min(1).max(1000) }),
  z.object({
    kind: z.literal("confirm"),
    pendingId: z.uuid(),
    edits: z.array(z.object({
      index: z.number().int().min(0).max(4),
      amountCents: z.number().int().positive().max(99_999_999_99).optional(),
      categoryId: z.uuid().nullable().optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      description: z.string().max(140).optional(),
    })).max(5).optional(),
  }),
  z.object({ kind: z.literal("cancel"), pendingId: z.uuid() }),
  z.object({ kind: z.literal("choose"), pendingId: z.uuid(), value: z.string().min(1).max(200), label: z.string().max(200).optional() }),
  z.object({ kind: z.literal("undo"), batchId: z.uuid().optional() }),
  // Fase 6: foto (reduzida no aparelho) e áudio curto. Base64; limites conferidos de novo no motor.
  z.object({ kind: z.literal("image"), mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]), base64: z.string().min(100).max(5_500_000).regex(/^[A-Za-z0-9+/=]+$/) }),
  z.object({ kind: z.literal("audio"), mimeType: z.string().regex(/^audio\/[\w.+-]+(;\s*codecs=[\w.]+)?$/).max(60), base64: z.string().min(100).max(3_500_000).regex(/^[A-Za-z0-9+/=]+$/), seconds: z.number().int().min(1).max(120) }),
]);

export type ChatMessage = { id: string; role: "user" | "assistant"; body: string; reply?: ChatReply; createdAt: string };

function userLabel(input: z.infer<typeof inputSchema>) {
  switch (input.kind) {
    case "text": return input.text;
    case "confirm": return "Confirmar";
    case "cancel": return "Cancelar";
    case "choose": return input.label ?? "Escolhi uma opção";
    case "undo": return "Desfazer";
    case "image": return "📷 Foto enviada";
    case "audio": return `🎤 Áudio (${input.seconds} s)`;
  }
}

export async function sendAssistantAction(raw: unknown): Promise<{ ok: true; messages: ChatMessage[] } | { ok: false; message: string }> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Mensagem inválida." };
  const user = await requireUser();
  const { workspaces, active } = await getWorkspaceContext();
  const supabase = await createClient();
  const input = parsed.data;

  const { data: userRow, error: e1 } = await supabase
    .from("assistant_messages")
    .insert({
      role: "user", body: userLabel(input).slice(0, 4096), workspace_id: active.id, channel: "app",
      input_kind: input.kind === "image" ? "photo" : input.kind === "audio" ? "audio" : "text",
    })
    .select("id, created_at")
    .single();
  if (e1) return { ok: false, message: "Não consegui registrar a mensagem." };

  let replies: ChatReply[];
  try {
    const engineInput = (input.kind === "choose" ? { kind: "choose", pendingId: input.pendingId, value: input.value }
      : input.kind === "audio" ? { ...input, filename: input.mimeType.includes("mp4") ? "audio.m4a" : input.mimeType.includes("ogg") ? "audio.ogg" : "audio.webm" }
      : input) as ChatInput;
    replies = await handleAssistant(
      { supabase, userId: user.id, channel: "app", activeWorkspaceId: active.id, workspaces: workspaces.map((w) => ({ id: w.id, kind: w.kind, name: w.name })) },
      engineInput,
    );
  } catch (err) {
    console.error("assistente:", err);
    replies = [{ text: "Tive um problema para processar. Tente de novo em instantes.", tone: "error" }];
  }

  const { data: rows } = await supabase
    .from("assistant_messages")
    .insert(replies.map((r) => ({ role: "assistant", body: r.text.slice(0, 4096), payload: r as never, workspace_id: active.id, channel: "app" })))
    .select("id, body, payload, created_at");
  if (replies.some((r) => r.done)) revalidatePath("/", "layout");

  return {
    ok: true,
    messages: [
      { id: userRow.id, role: "user", body: userLabel(input), createdAt: userRow.created_at },
      ...(rows ?? []).map((r) => ({ id: r.id, role: "assistant" as const, body: r.body, reply: r.payload as ChatReply, createdAt: r.created_at })),
    ],
  };
}

export async function clearAssistantHistoryAction(): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from("assistant_messages").delete().eq("user_id", user.id).eq("channel", "app");
  await supabase.from("assistant_sessions").delete().eq("user_id", user.id).eq("channel", "app");
  revalidatePath("/assistente");
  return { ok: true };
}
