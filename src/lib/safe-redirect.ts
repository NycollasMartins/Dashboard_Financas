/**
 * Garante que um destino de redirecionamento é um caminho INTERNO da aplicação.
 * Evita "open redirect" (ex.: ?next=https://site-malicioso.com).
 *
 * Aceita caminhos relativos ("/painel") e URLs absolutas da própria origem
 * (os e-mails do Supabase mandam a URL completa em `next`).
 */
export function safeNextPath(
  next: string | null | undefined,
  origin: string,
  fallback = "/painel",
): string {
  if (!next) return fallback;
  try {
    const base = new URL(origin);
    const url = new URL(next, base);
    if (url.origin !== base.origin) return fallback;
    // Bloqueia "//evil.com" e "/\evil.com", que alguns navegadores tratam como externo.
    if (!url.pathname.startsWith("/") || url.pathname.startsWith("//") || url.pathname.includes("\\")) {
      return fallback;
    }
    // Não volta para a própria rota de confirmação (evita loops).
    if (url.pathname.startsWith("/auth/")) return fallback;
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
}
