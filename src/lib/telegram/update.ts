import { z } from "zod";

/** Formato (parcial) de um update da Bot API — só os campos que usamos. Puro/testável. */
const chat = z.object({ id: z.number(), type: z.string() });
const from = z.object({ id: z.number(), first_name: z.string().optional(), username: z.string().optional() });
const photoSize = z.object({ file_id: z.string(), width: z.number(), height: z.number(), file_size: z.number().optional() });
const message = z.object({
  message_id: z.number(),
  chat,
  from: from.optional(),
  text: z.string().max(4096).optional(),
  caption: z.string().max(1024).optional(),
  photo: z.array(photoSize).optional(),
  document: z.object({ file_id: z.string(), mime_type: z.string().optional(), file_size: z.number().optional() }).optional(),
  voice: z.object({ file_id: z.string(), duration: z.number(), mime_type: z.string().optional(), file_size: z.number().optional() }).optional(),
  audio: z.object({ file_id: z.string(), duration: z.number(), mime_type: z.string().optional(), file_size: z.number().optional() }).optional(),
});
export const updateSchema = z.object({
  update_id: z.number().int().nonnegative(),
  message: message.optional(),
  edited_message: message.optional(),
  callback_query: z.object({
    id: z.string(),
    from,
    data: z.string().max(64).optional(),
    message: z.object({ message_id: z.number(), chat }).optional(),
  }).optional(),
});
export type TgUpdate = z.infer<typeof updateSchema>;
export type UpdateKind = "text" | "photo" | "voice" | "callback" | "command" | "other";

export function classify(u: TgUpdate): { kind: UpdateKind; chatId: number | null; private: boolean } {
  if (u.callback_query) {
    const c = u.callback_query.message?.chat;
    return { kind: "callback", chatId: c?.id ?? null, private: c?.type === "private" };
  }
  const m = u.message;
  if (!m) return { kind: "other", chatId: u.edited_message?.chat.id ?? null, private: u.edited_message?.chat.type === "private" };
  const kind: UpdateKind = m.text?.startsWith("/") ? "command"
    : m.text ? "text"
    : m.photo || m.document?.mime_type?.startsWith("image/") ? "photo"
    : m.voice || m.audio ? "voice"
    : "other";
  return { kind, chatId: m.chat.id, private: m.chat.type === "private" };
}

