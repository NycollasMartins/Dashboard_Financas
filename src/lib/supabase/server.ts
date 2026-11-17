import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";
import { fetchWithClockSkewRetry } from "./fetch-with-clock-skew-retry";

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Usa a chave PUBLICÁVEL + cookies do usuário → todas as consultas passam pela RLS.
 * Crie um novo cliente por requisição (nunca reutilize entre requisições).
 */
export async function createClient() {
  // Dados do Supabase são sempre por usuário e por requisição: nunca entram em
  // prerender/prefetch (o supabase-js usa Date.now() para checar o JWT).
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      global: { fetch: fetchWithClockSkewRetry },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado de um Server Component (cookies somente leitura).
            // Sem problema: o proxy.ts renova a sessão a cada requisição.
          }
        },
      },
    },
  );
}
