#!/usr/bin/env node
/**
 * Segredos de PRODUÇÃO gerados localmente → .env.production.local (ignorado pelo git).
 * NUNCA imprime valores. Não sobrescreve um valor que já exista (rode quantas vezes quiser).
 *
 *   pnpm env:gen              gera o que faltar (CRON_SECRET, TELEGRAM_WEBHOOK_SECRET, par VAPID)
 *                             e cria as demais linhas vazias para você preencher
 *   pnpm env:copy NOME        copia o valor de NOME para a área de transferência (macOS), sem mostrar
 */
import { execFileSync, execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import webpush from "web-push";

const FILE = ".env.production.local";

// Ordem = ordem do docs/easypanel-variaveis.md
export const VARS = [
  ["NEXT_PUBLIC_SITE_URL", "https://larmais.tech"],
  ["NEXT_PUBLIC_SUPABASE_URL", ""],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ""],
  ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", ""],
  ["SUPABASE_SECRET_KEY", ""],
  ["GEMINI_API_KEY", ""],
  ["GROQ_API_KEY", ""],
  ["TELEGRAM_BOT_TOKEN", ""],
  ["TELEGRAM_WEBHOOK_SECRET", ""],
  ["TELEGRAM_BOT_USERNAME", "LarMaisBot"],
  ["VAPID_PRIVATE_KEY", ""],
  ["VAPID_SUBJECT", "mailto:contato@larmais.tech"],
  ["CRON_SECRET", ""],
];

function read() {
  const map = new Map();
  if (!existsSync(FILE)) return map;
  for (const line of readFileSync(FILE, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

function ensureIgnored() {
  try {
    execFileSync("git", ["check-ignore", "-q", FILE]);
  } catch {
    console.error(`✗ ${FILE} NÃO está no .gitignore — abortando por segurança.`);
    process.exit(1);
  }
}

const cmd = process.argv[2] ?? "gen";
ensureIgnored();

if (cmd === "copy") {
  const name = process.argv[3];
  const v = read().get(name ?? "");
  if (!v) {
    console.error(`✗ ${name ?? "(sem nome)"} vazio ou inexistente em ${FILE}.`);
    process.exit(1);
  }
  execSync("pbcopy", { input: v });
  console.log(`✓ ${name} copiado para a área de transferência (${v.length} caracteres). Cole onde indicado e depois copie outra coisa qualquer para limpar.`);
  process.exit(0);
}

const env = read();
const generated = [];
const gen = (name, fn) => {
  if (!env.get(name)) {
    env.set(name, fn());
    generated.push(name);
  }
};
gen("CRON_SECRET", () => randomBytes(32).toString("hex"));
gen("TELEGRAM_WEBHOOK_SECRET", () => randomBytes(32).toString("hex"));
if (!env.get("VAPID_PRIVATE_KEY") || !env.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY")) {
  const { publicKey, privateKey } = webpush.generateVAPIDKeys();
  env.set("NEXT_PUBLIC_VAPID_PUBLIC_KEY", publicKey);
  env.set("VAPID_PRIVATE_KEY", privateKey);
  generated.push("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY");
}
for (const [k, def] of VARS) if (!env.has(k) || (env.get(k) === "" && def)) env.set(k, env.get(k) || def);

const lines = [
  "# Lar+ · PRODUÇÃO — NUNCA commitar, NUNCA colar em chat. Gerado por `pnpm env:gen`.",
  "# Preencha os vazios; confira com `pnpm env:check`; copie para o EasyPanel (docs/easypanel-variaveis.md).",
  ...VARS.map(([k]) => `${k}=${env.get(k) ?? ""}`),
  ...[...env.keys()].filter((k) => !VARS.some(([v]) => v === k)).map((k) => `${k}=${env.get(k)}`),
  "",
];
writeFileSync(FILE, lines.join("\n"), { mode: 0o600 });
chmodSync(FILE, 0o600);
console.log(`✓ ${FILE} atualizado (permissão só sua: 600).`);
console.log(generated.length ? `  Gerados agora: ${generated.join(", ")}` : "  Nada novo gerado (os segredos já existiam).");
const empty = VARS.filter(([k]) => !env.get(k)).map(([k]) => k);
if (empty.length) console.log(`  Para você preencher: ${empty.join(", ")}`);
