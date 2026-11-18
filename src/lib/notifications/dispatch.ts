import "server-only";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage, TelegramError } from "@/lib/telegram/api";
import { esc } from "@/lib/telegram/render";
import { pushConfigured, sendPush } from "./push";

/*
 * DISPATCHER (ADR-0023): chamado pelo pg_cron (via pg_net) em
 * /api/notifications/dispatch com segredo. Pega um lote da fila (o banco já
 * respeita o horário de silêncio e nunca entrega duas vezes) e envia:
 *   push → todas as assinaturas da pessoa (404/410 apaga a assinatura);
 *   telegram → chat vinculado (com botão "Abrir no Lar+").
 * Erro → finish(retry) com espera crescente; 5 falhas → dead-letter.
 */
export async function dispatchNotifications(limit = 50) {
  const admin = createAdminClient();
  const { data: batch, error } = await admin.rpc("claim_notification_deliveries", { p_limit: limit });
  if (error) throw error;
  const stats = { sent: 0, skipped: 0, retry: 0 };
  const site = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

  for (const d of batch ?? []) {
    let result: "sent" | "skipped" | "retry" = "skipped";
    let err: string | null = null;
    try {
      if (d.channel === "push") {
        const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", d.user_id);
        if (subs?.length && pushConfigured()) {
          const outcomes = await Promise.all(subs.map(async (s) => {
            const r = await sendPush(s, { title: d.title, body: d.body, url: d.url, tag: d.delivery_id });
            if (r === "gone") await admin.from("push_subscriptions").delete().eq("id", s.id);
            else if (r === "sent") await admin.from("push_subscriptions").update({ last_success_at: new Date().toISOString(), failures: 0 }).eq("id", s.id);
            return r;
          }));
          result = outcomes.includes("sent") ? "sent" : outcomes.includes("retry") ? "retry" : "skipped";
          if (result === "retry") err = "falha no serviço de push";
        }
      } else if (d.channel === "telegram" && d.telegram_chat_id) {
        const keyboard = site.startsWith("https://") ? [[{ text: "Abrir no Lar+", url: `${site}${d.url}` }]] : undefined;
        await sendMessage(d.telegram_chat_id, `🔔 <b>${esc(d.title)}</b>\n${esc(d.body)}`, keyboard);
        result = "sent";
      }
    } catch (e) {
      // Bot bloqueado/chat apagado: não adianta repetir.
      if (e instanceof TelegramError && (e.status === 403 || e.status === 400)) result = "skipped";
      else result = "retry";
      err = e instanceof Error ? e.message.slice(0, 300) : "erro";
    }
    await admin.rpc("finish_notification_delivery", { p_id: d.delivery_id, p_result: result, p_error: err ?? undefined });
    stats[result]++;
  }
  return stats;
}
