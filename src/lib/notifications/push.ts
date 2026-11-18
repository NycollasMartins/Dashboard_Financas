import "server-only";
import webpush from "web-push";
import { serverEnv } from "@/lib/env.server";

/*
 * Envio de Web Push (VAPID). A chave PRIVADA fica só no servidor; a pública vai
 * para o navegador (NEXT_PUBLIC_VAPID_PUBLIC_KEY) no momento da assinatura.
 */
export const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
export const pushConfigured = () => Boolean(vapidPublicKey && serverEnv.VAPID_PRIVATE_KEY);

let configured = false;
function setup() {
  if (configured) return;
  if (!pushConfigured()) throw new Error("VAPID não configurado");
  webpush.setVapidDetails(serverEnv.VAPID_SUBJECT, vapidPublicKey, serverEnv.VAPID_PRIVATE_KEY!);
  configured = true;
}

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string; url: string; tag?: string };

/** "gone" = assinatura expirada/removida (404/410) → apagar. */
export async function sendPush(target: PushTarget, payload: PushPayload): Promise<"sent" | "gone" | "retry"> {
  setup();
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24, urgency: "normal", timeout: 10_000 },
    );
    return "sent";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    return "retry";
  }
}
