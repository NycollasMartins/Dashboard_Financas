#!/usr/bin/env node
/**
 * Segredos de PRODUÇÃO gerados localmente → .env.production.local (ignorado pelo git).
 * NUNCA imprime valores. Não sobrescreve um valor que já exista (rode quantas vezes quiser).
 *
 *   pnpm env:gen              gera o que faltar (CRON_SECRET, TELEGRAM_WEBHOOK_SECRET, par VAPID)
 *                             e cria as demais linhas vazias para você preencher
 *   pnpm env:copy NOME        copia o valor de NOME para a área de transferência (macOS), sem mostrar
 *   pnpm env:check            confere presença e FORMATO de todas as variáveis, sem mostrar valores
 *   pnpm env:copy-all         copia TODAS as linhas NOME=valor (sem comentários) para colar no EasyPanel
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

// Formato esperado de cada variável (nunca imprimimos o valor, só ✓/✗ e a dica).
const RULES = {
  NEXT_PUBLIC_SITE_URL: [/^https:\/\/larmais\.tech$/, "exatamente https://larmais.tech (sem barra no fim)"],
  NEXT_PUBLIC_SUPABASE_URL: [/^https:\/\/[a-z0-9]{20}\.supabase\.co$/, "https://<ref de 20 letras>.supabase.co (sem barra no fim)"],
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: [/^sb_publishable_[A-Za-z0-9_-]{20,}$/, "começa com sb_publishable_"],
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: [/^[A-Za-z0-9_-]{80,100}$/, "chave pública VAPID (pnpm env:gen)"],
  SUPABASE_SECRET_KEY: [/^sb_secret_[A-Za-z0-9_-]{20,}$/, "começa com sb_secret_ (Project Settings → API Keys → Secret keys)"],
  GEMINI_API_KEY: [/^(AIza[0-9A-Za-z_-]{30,}|AQ\.[A-Za-z0-9_-]{20,})$/, "chave do Google AI Studio (AIza… ou AQ.…)"],
  GROQ_API_KEY: [/^gsk_[A-Za-z0-9]{40,}$/, "começa com gsk_"],
  TELEGRAM_BOT_TOKEN: [/^\d{6,12}:[A-Za-z0-9_-]{30,}$/, "formato 123456789:AA… (do @BotFather)"],
  TELEGRAM_WEBHOOK_SECRET: [/^[A-Za-z0-9_-]{24,256}$/, "24–256 caracteres A-Z a-z 0-9 _ - (pnpm env:gen)"],
  TELEGRAM_BOT_USERNAME: [/^\w{2,29}bot$/i, "usuário do bot sem @, terminando em bot (ex.: LarMaisBot)"],
  VAPID_PRIVATE_KEY: [/^[A-Za-z0-9_-]{40,50}$/, "chave privada VAPID (pnpm env:gen)"],
  VAPID_SUBJECT: [/^(mailto:[^@\s]+@[^@\s]+|https:\/\/\S+)$/, "mailto:contato@larmais.tech"],
  CRON_SECRET: [/^[A-Za-z0-9_-]{24,256}$/, "24+ caracteres (pnpm env:gen) — o MESMO valor do Vault larmais_cron_secret"],
};

if (cmd === "check") {
  const env = read();
  let bad = 0;
  for (const [k] of VARS) {
    const v = env.get(k) ?? "";
    const [re, hint] = RULES[k];
    const issue = !v ? "vazio" : v !== v.trim() ? "tem espaço no começo/fim" : /^["']|["']$/.test(v) ? "tem aspas (tire)" : !re.test(v) ? "formato inesperado" : null;
    if (issue) bad++;
    console.log(`${issue ? "✗" : "✓"} ${k.padEnd(38)} ${issue ? `${issue} — esperado: ${hint}` : "ok"}`);
  }
  // Coerência: o ref do Supabase bate com o projeto vinculado?
  const url = env.get("NEXT_PUBLIC_SUPABASE_URL") ?? "";
  if (existsSync("supabase/.temp/project-ref") && url) {
    const ref = readFileSync("supabase/.temp/project-ref", "utf8").trim();
    const ok = url.includes(`//${ref}.`);
    if (!ok) bad++;
    console.log(`${ok ? "✓" : "✗"} ${"URL do Supabase = projeto vinculado".padEnd(38)} ${ok ? "ok" : "a URL não é do projeto do `supabase link`"}`);
  }
  // Chaves de produção não devem ser as mesmas do desenvolvimento (.env.local).
  const dev = (() => { try { return new Map(readFileSync(".env.local", "utf8").split("\n").map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l.trim())).filter(Boolean).map((m) => [m[1], m[2]])); } catch { return new Map(); } })();
  for (const k of ["GEMINI_API_KEY", "GROQ_API_KEY", "TELEGRAM_BOT_TOKEN", "VAPID_PRIVATE_KEY", "CRON_SECRET", "SUPABASE_SECRET_KEY"]) {
    if (env.get(k) && dev.get(k) === env.get(k)) console.log(`⚠ ${k.padEnd(38)} é IGUAL à do .env.local (desenvolvimento) — use uma chave só de produção`);
  }
  console.log(bad ? `\n✗ ${bad} problema(s). Corrija no ${FILE} e rode de novo.` : `\n✓ Tudo certo (${VARS.length} variáveis). Copie para o EasyPanel: docs/easypanel-variaveis.md`);
  process.exit(bad ? 1 : 0);
}

if (cmd === "copy-all") {
  const env = read();
  const missing = VARS.filter(([k]) => !env.get(k)).map(([k]) => k);
  if (missing.length) {
    console.error(`✗ Ainda vazias: ${missing.join(", ")}. Rode pnpm env:check.`);
    process.exit(1);
  }
  execSync("pbcopy", { input: VARS.map(([k]) => `${k}=${env.get(k)}`).join("\n") + "\n" });
  console.log(`✓ ${VARS.length} variáveis copiadas. Cole em EasyPanel → app → Environment, salve, e depois copie outra coisa para limpar a área de transferência.`);
  process.exit(0);
}

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
