import { connection } from "next/server";
import { publicEnv } from "@/lib/env";
import { serverEnv, serverEnvStatus, type EnvStatus } from "@/lib/env.server";

const present = (v: string | undefined): EnvStatus => (v && v.trim() ? "ok" : "ausente");

/**
 * Diagnóstico de produção: só "ok / ausente / inválido" por variável — NUNCA o valor
 * (nem pedaços dele). O nome do bot é público (t.me/…), então aparece.
 */
function integrationStatus() {
  const s = serverEnvStatus;
  const telegramReady = s.TELEGRAM_BOT_TOKEN === "ok" && s.TELEGRAM_WEBHOOK_SECRET === "ok" && s.SUPABASE_SECRET_KEY === "ok";
  return {
    telegram: {
      pronto: telegramReady,
      TELEGRAM_BOT_TOKEN: s.TELEGRAM_BOT_TOKEN,
      TELEGRAM_WEBHOOK_SECRET: s.TELEGRAM_WEBHOOK_SECRET,
      TELEGRAM_BOT_USERNAME: `${s.TELEGRAM_BOT_USERNAME} (@${serverEnv.TELEGRAM_BOT_USERNAME})`,
      SUPABASE_SECRET_KEY: s.SUPABASE_SECRET_KEY,
    },
    ia: {
      ativada: process.env.ASSISTANT_AI_ENABLED !== "false",
      GEMINI_API_KEY: present(process.env.GEMINI_API_KEY),
      GROQ_API_KEY: present(process.env.GROQ_API_KEY),
    },
    push: {
      pronto: present(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) === "ok" && s.VAPID_PRIVATE_KEY === "ok",
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: present(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      VAPID_PRIVATE_KEY: s.VAPID_PRIVATE_KEY,
      VAPID_SUBJECT: s.VAPID_SUBJECT,
    },
    cron: {
      pronto: s.CRON_SECRET === "ok" && s.SUPABASE_SECRET_KEY === "ok",
      CRON_SECRET: s.CRON_SECRET,
    },
  };
}

/**
 * Healthcheck do contêiner (Docker/EasyPanel). Responde rápido e SEM depender do
 * banco: se o Supabase cair, o contêiner não deve ficar reiniciando.
 * `?deep=1` também testa se o Supabase responde (diagnóstico manual).
 * Nunca devolve segredos nem dados de usuários.
 */
export async function GET(request: Request) {
  await connection();
  const body: Record<string, unknown> = {
    status: "ok",
    app: "larmais",
    version: process.env.APP_VERSION ?? "dev",
    time: new Date().toISOString(),
  };
  if (new URL(request.url).searchParams.get("deep") === "1") {
    try {
      const res = await fetch(`${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
        headers: { apikey: publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
        signal: AbortSignal.timeout(3000),
      });
      body.supabase = res.ok ? "ok" : `erro ${res.status}`;
    } catch {
      body.supabase = "inacessível";
    }
    body.integracoes = integrationStatus();
  }
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
