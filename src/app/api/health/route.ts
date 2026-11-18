import { connection } from "next/server";
import { publicEnv } from "@/lib/env";

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
  }
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
