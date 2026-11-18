import "server-only";
import { serverEnv } from "@/lib/env.server";

/*
 * Cliente mínimo da Bot API do Telegram (gratuita). Retentativas em 429
 * (respeita retry_after) e 5xx; erros 4xx de conteúdo não são repetidos.
 * O token NUNCA vai para log.
 */

export type InlineKeyboard = { text: string; callback_data?: string; url?: string }[][];

export class TelegramError extends Error {
  constructor(public status: number, public description: string, public method: string) {
    super(`Telegram ${method}: ${status} ${description}`);
  }
}

const base = () => {
  if (!serverEnv.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN não configurado");
  return `https://api.telegram.org/bot${serverEnv.TELEGRAM_BOT_TOKEN}`;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function tg<T = unknown>(method: string, payload: Record<string, unknown>, attempts = 3): Promise<T> {
  let last: TelegramError | null = null;
  for (let i = 0; i < attempts; i++) {
    let res: Response;
    try {
      res = await fetch(`${base()}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      last = new TelegramError(0, "falha de rede", method);
      await sleep(500 * (i + 1));
      continue;
    }
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string; parameters?: { retry_after?: number } };
    if (res.ok && body.ok) return body.result as T;
    last = new TelegramError(res.status, body.description ?? "erro", method);
    if (res.status === 429) await sleep(Math.min(10, body.parameters?.retry_after ?? 1) * 1000);
    else if (res.status >= 500) await sleep(500 * (i + 1));
    else break; // 400/403: não adianta repetir
  }
  throw last!;
}

export const sendMessage = (chatId: number | string, text: string, keyboard?: InlineKeyboard) =>
  tg<{ message_id: number }>("sendMessage", {
    chat_id: chatId, text, parse_mode: "HTML", link_preview_options: { is_disabled: true },
    ...(keyboard?.length ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });

export async function editMessage(chatId: number | string, messageId: number, text: string, keyboard?: InlineKeyboard) {
  try {
    await tg("editMessageText", {
      chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", link_preview_options: { is_disabled: true },
      reply_markup: { inline_keyboard: keyboard ?? [] },
    });
  } catch (e) {
    // "message is not modified" (clique duplo) não é erro.
    if (!(e instanceof TelegramError && /not modified/i.test(e.description))) throw e;
  }
}

export const answerCallback = (id: string, text?: string) =>
  tg("answerCallbackQuery", { callback_query_id: id, ...(text ? { text } : {}) }, 1).catch(() => undefined);

export const sendTyping = (chatId: number | string) =>
  tg("sendChatAction", { chat_id: chatId, action: "typing" }, 1).catch(() => undefined);

/** Baixa um arquivo (foto/voz) para a MEMÓRIA. Nunca grava em disco. */
export async function downloadFile(fileId: string, maxBytes: number): Promise<{ base64: string; path: string }> {
  const f = await tg<{ file_path?: string; file_size?: number }>("getFile", { file_id: fileId });
  if (!f.file_path) throw new Error("arquivo indisponível");
  if ((f.file_size ?? 0) > maxBytes) throw new Error("arquivo grande demais");
  const res = await fetch(`https://api.telegram.org/file/bot${serverEnv.TELEGRAM_BOT_TOKEN}/${f.file_path}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`download falhou (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > maxBytes) throw new Error("arquivo grande demais");
  return { base64: buf.toString("base64"), path: f.file_path };
}
