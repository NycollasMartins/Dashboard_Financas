import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com a chave secreta do Supabase LOCAL (a padrão do CLI, pública na
 * documentação; só funciona no banco local/CI). Usado para preparar dados que
 * só o servidor cria (notificações, vínculo do Telegram).
 */
export function localAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    process.env.SUPABASE_SECRET_KEY || "",
    { auth: { persistSession: false } },
  );
}

export async function userId(email: string) {
  const { data } = await localAdmin().auth.admin.listUsers();
  return data.users.find((u) => u.email === email)!.id;
}
