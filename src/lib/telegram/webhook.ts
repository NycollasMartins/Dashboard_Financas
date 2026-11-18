import "server-only";
import type { AiParser } from "@/lib/assistant/providers/types";
import { serverEnv } from "@/lib/env.server";
import { safeEqual } from "@/lib/security/secret";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage } from "./api";
import { classify, isPermanentTelegramError, processUpdate, updateSchema } from "./handler";

/*
 * Webhook do @LarMaisBot (ADR-0021). Separado da rota para ser testável.
 *  1. Confere o header X-Telegram-Bot-Api-Secret-Token (tempo constante) → 401.
 *  2. Registra o update_id (idempotência: o Telegram reenvia se demorarmos).
 *  3. Responde 200 NA HORA e processa depois (`schedule` = after() do Next).
 *  4. Falha → avisa a pessoa e marca 'failed'/'dead' (aparece em ops_dead_letters).
 *     Não há reprocessamento automático de propósito: o conteúdo da mensagem não é
 *     guardado (privacidade). Envios ao Telegram já têm retentativa (429/5xx).
 */
export async function handleTelegramWebhook(
  request: Request,
  schedule: (task: () => Promise<void>) => void,
  deps: { providers?: AiParser[] } = {},
): Promise<Response> {
  if (!serverEnv.TELEGRAM_WEBHOOK_SECRET || !serverEnv.TELEGRAM_BOT_TOKEN || !serverEnv.SUPABASE_SECRET_KEY) {
    return new Response("bot desativado", { status: 503 });
  }
  if (!safeEqual(request.headers.get("x-telegram-bot-api-secret-token"), serverEnv.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response("unauthorized", { status: 401 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > 1_000_000) return new Response("too large", { status: 413 });

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: true }); // formato desconhecido: ignora (200 evita reenvio)
  const update = parsed.data;
  const { kind, chatId } = classify(update);

  const admin = createAdminClient();
  const { error } = await admin.from("telegram_updates").insert({ update_id: update.update_id, chat_id: chatId, kind });
  if (error?.code === "23505") return Response.json({ ok: true, duplicate: true }); // já recebido
  if (error) return new Response("db", { status: 500 }); // o Telegram tenta de novo

  schedule(async () => {
    await admin.from("telegram_updates").update({ status: "processing", attempts: 1 }).eq("update_id", update.update_id);
    try {
      const status = await processUpdate(update, deps);
      await admin.from("telegram_updates").update({ status, finished_at: new Date().toISOString() }).eq("update_id", update.update_id);
    } catch (e) {
      // Sem conteúdo no log: só o tipo de erro.
      const msg = e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 300) : "erro";
      console.error(`telegram: update ${update.update_id} (${kind}) falhou — ${msg}`);
      await admin.from("telegram_updates")
        .update({ status: isPermanentTelegramError(e) ? "dead" : "failed", last_error: msg, finished_at: new Date().toISOString() })
        .eq("update_id", update.update_id);
      if (chatId && !isPermanentTelegramError(e)) {
        await sendMessage(chatId, "Tive um problema para responder essa mensagem. Confira no app se algo foi gravado antes de mandar de novo.").catch(() => undefined);
      }
    }
  });
  return Response.json({ ok: true });
}
