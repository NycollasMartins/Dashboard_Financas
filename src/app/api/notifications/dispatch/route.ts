import { connection } from "next/server";
import { serverEnv } from "@/lib/env.server";
import { dispatchNotifications } from "@/lib/notifications/dispatch";
import { safeEqual } from "@/lib/security/secret";

/**
 * Disparo de notificações (pg_cron → pg_net, a cada 15 min). Protegido pelo
 * header x-cron-secret (CRON_SECRET, igual ao segredo 'larmais_cron_secret' do Vault).
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  await connection();
  if (!serverEnv.CRON_SECRET || !serverEnv.SUPABASE_SECRET_KEY) return new Response("desativado", { status: 503 });
  if (!safeEqual(request.headers.get("x-cron-secret"), serverEnv.CRON_SECRET)) return new Response("unauthorized", { status: 401 });
  try {
    const stats = await dispatchNotifications();
    return Response.json({ ok: true, ...stats });
  } catch (e) {
    console.error(`notificações: falha no disparo — ${e instanceof Error ? e.message : "erro"}`);
    return Response.json({ ok: false }, { status: 500 });
  }
}
