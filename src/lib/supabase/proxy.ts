import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/** Rotas acessíveis sem login. */
const PUBLIC_PATHS = ["/entrar", "/cadastro", "/recuperar-senha", "/auth/"];
/** Rotas de autenticação: quem já está logado é mandado para o painel. */
const AUTH_ONLY_PATHS = ["/entrar", "/cadastro", "/recuperar-senha"];

/**
 * Renova a sessão (cookies) a cada requisição e faz o redirecionamento
 * "otimista" de quem não está logado. A autorização REAL acontece no banco (RLS)
 * e nas Server Actions — o proxy é só conveniência de navegação.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // IMPORTANTE: nada entre createServerClient e getClaims (evita logouts aleatórios).
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));
  const isAuthOnly = AUTH_ONLY_PATHS.some((p) => pathname === p);

  if (!isLoggedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return redirectWithCookies(url, response);
  }

  if (isLoggedIn && isAuthOnly) {
    const url = request.nextUrl.clone();
    url.pathname = "/painel";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  return response;
}

function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  return redirect;
}
