import { createClient } from "@supabase/supabase-js";
import { localSupabaseSecret } from "../src/test/local-supabase";

/**
 * Cliente com a chave secreta do Supabase LOCAL (lida do `supabase status`; só
 * funciona no banco local/CI). Usado para preparar dados que
 * só o servidor cria (notificações, vínculo do Telegram).
 */
export function localAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    localSupabaseSecret(),
    { auth: { persistSession: false } },
  );
}

export async function userId(email: string) {
  const { data } = await localAdmin().auth.admin.listUsers();
  return data.users.find((u) => u.email === email)!.id;
}
