import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "./database.types";

/**
 * Cliente com a SECRET KEY (ignora RLS). Uso RESTRITO (ADR-0004/0021):
 *   • webhook do Telegram: achar o usuário pelo chat vinculado, idempotência;
 *   • dispatcher de notificações: fila de todos os usuários.
 * NUNCA para gravar dados financeiros: isso passa pelo cliente com a sessão do
 * próprio usuário (src/lib/telegram/session.ts) → RLS e auditoria valem igual ao app.
 */
export function createAdminClient() {
  if (!serverEnv.SUPABASE_SECRET_KEY) throw new Error("SUPABASE_SECRET_KEY não configurada");
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
