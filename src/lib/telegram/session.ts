import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

/*
 * SESSÃO DO USUÁRIO VINCULADO (ADR-0021). O webhook não tem cookie de ninguém;
 * para que TODA regra valha igual ao app (RLS, created_by = auth.uid(),
 * auditoria), abrimos uma sessão normal da pessoa dona do chat:
 *   1) admin.generateLink(magiclink) → token de uso único (NÃO envia e-mail);
 *   2) verifyOtp(token_hash) → sessão (access token ~1 h).
 * O token fica SÓ em memória (cache por usuário, renovado 5 min antes de vencer).
 * Ninguém vê o link; nada é gravado. Quem decide o usuário é o vínculo do chat.
 */

type Cached = { token: string; expiresAt: number };
const cache = new Map<string, Cached>();
const inflight = new Map<string, Promise<string>>();

async function mintToken(userId: string): Promise<string> {
  const admin = createAdminClient();
  const { data: u, error: e1 } = await admin.auth.admin.getUserById(userId);
  if (e1 || !u.user?.email) throw new Error("usuário do vínculo não encontrado");
  const { data: link, error: e2 } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
  if (e2 || !link.properties?.hashed_token) throw new Error("não foi possível abrir a sessão");
  const anon = createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: s, error: e3 } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (e3 || !s.session) throw new Error("não foi possível validar a sessão");
  if (s.user?.id !== userId) throw new Error("sessão de outro usuário");
  cache.set(userId, { token: s.session.access_token, expiresAt: (s.session.expires_at ?? 0) * 1000 });
  return s.session.access_token;
}

async function accessToken(userId: string): Promise<string> {
  const hit = cache.get(userId);
  if (hit && hit.expiresAt - Date.now() > 5 * 60_000) return hit.token;
  // Duas mensagens ao mesmo tempo → uma única sessão.
  let p = inflight.get(userId);
  if (!p) {
    p = mintToken(userId).finally(() => inflight.delete(userId));
    inflight.set(userId, p);
  }
  return p;
}

/** Cliente Supabase COM A SESSÃO do usuário (RLS vale). */
export async function createUserClient(userId: string): Promise<SupabaseClient<Database>> {
  const token = await accessToken(userId);
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/** Ao desvincular/excluir: esquece a sessão em memória. */
export function forgetUserSession(userId: string) {
  cache.delete(userId);
}
