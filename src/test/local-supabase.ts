import { execSync } from "node:child_process";

/**
 * Chave secreta do Supabase LOCAL, lida em tempo de execução do `supabase status`
 * (nunca escrita no código — a proteção de segredos do GitHub bloqueia, com razão).
 * Ordem: variável SUPABASE_SECRET_KEY (CI e .env.local) → `supabase status`.
 */
export function localSupabaseSecret(): string {
  if (process.env.SUPABASE_SECRET_KEY) return process.env.SUPABASE_SECRET_KEY;
  try {
    const out = execSync("supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return /^SECRET_KEY="?([^"\n]+)"?$/m.exec(out)?.[1] ?? "";
  } catch {
    return "";
  }
}
