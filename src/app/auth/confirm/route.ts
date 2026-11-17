import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES = new Set<EmailOtpType>(["email", "signup", "recovery", "email_change", "invite", "magiclink"]);

/**
 * Destino dos links enviados por e-mail (confirmação, recuperação, troca de e-mail).
 * Usa token_hash (funciona mesmo abrindo o link em outro dispositivo) e aceita
 * também o fluxo PKCE (?code=) por compatibilidade.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const rawType = params.get("type") as EmailOtpType | null;
  const code = params.get("code");
  const type = rawType && OTP_TYPES.has(rawType) ? rawType : null;

  const fallback = type === "recovery" ? "/redefinir-senha" : "/painel";
  const next = safeNextPath(params.get("next"), publicEnv.NEXT_PUBLIC_SITE_URL, fallback);

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(type === "recovery" ? "/redefinir-senha" : next);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
  }

  redirect("/entrar?erro=link");
}
