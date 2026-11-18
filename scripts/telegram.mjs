#!/usr/bin/env node
/**
 * Administra o webhook do bot do Telegram usando as VARIÁVEIS DE AMBIENTE
 * (lê .env.local se existir; nunca imprime o token).
 *
 *   pnpm telegram info            → estado do webhook (URL, pendentes, último erro)
 *   pnpm telegram:prod set|info   → o MESMO, lendo .env.production.local (bot de produção)
 *   pnpm telegram set             → registra {URL}/api/telegram/webhook + comandos
 *   pnpm telegram delete          → remove o webhook (e descarta pendentes)
 *
 * URL: TELEGRAM_WEBHOOK_URL (ex.: túnel do Cloudflare) ou NEXT_PUBLIC_SITE_URL.
 */
import { readFileSync } from "node:fs";

const PROD = process.argv.includes("--prod");
const ENV_FILE = PROD ? ".env.production.local" : ".env.local";
for (const line of (() => { try { return readFileSync(ENV_FILE, "utf8").split("\n"); } catch { return []; } })()) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const baseUrl = (process.env.TELEGRAM_WEBHOOK_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
if (!token) {
  console.error("✗ TELEGRAM_BOT_TOKEN não configurado (.env.local ou ambiente).");
  process.exit(1);
}
const api = async (method, payload = {}) => {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!body.ok) throw new Error(`${method}: ${body.description}`);
  return body.result;
};

const cmd = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "info";
if (PROD) console.log(`(lendo ${ENV_FILE})`);
if (cmd === "set") {
  if (!secret || !/^[A-Za-z0-9_-]{24,256}$/.test(secret)) {
    console.error("✗ TELEGRAM_WEBHOOK_SECRET ausente ou inválido (24–256 caracteres A-Z a-z 0-9 _ -). Gere com: openssl rand -hex 32");
    process.exit(1);
  }
  if (!baseUrl.startsWith("https://")) {
    console.error("✗ O Telegram exige HTTPS. Use NEXT_PUBLIC_SITE_URL=https://larmais.tech ou TELEGRAM_WEBHOOK_URL=https://<túnel>.");
    process.exit(1);
  }
  const url = `${baseUrl}/api/telegram/webhook`;
  await api("setWebhook", {
    url, secret_token: secret, drop_pending_updates: true, max_connections: 10,
    allowed_updates: ["message", "callback_query"],
  });
  await api("setMyCommands", { commands: [
    { command: "ajuda", description: "Exemplos do que posso fazer" },
    { command: "resumo", description: "Resumo do mês" },
    { command: "desfazer", description: "Desfaz o último registro" },
    { command: "espaco", description: "Escolher onde gravar (individual/família)" },
    { command: "desvincular", description: "Desligar este chat da sua conta" },
  ], language_code: "pt" });
  console.log(`✓ Webhook registrado em ${url} (com secret_token) e comandos atualizados.`);
} else if (cmd === "delete") {
  await api("deleteWebhook", { drop_pending_updates: true });
  console.log("✓ Webhook removido.");
} else {
  const me = await api("getMe");
  const info = await api("getWebhookInfo");
  console.log(`Bot: @${me.username}`);
  console.log(`Webhook: ${info.url || "(nenhum)"}`);
  console.log(`Pendentes: ${info.pending_update_count}`);
  if (info.last_error_message) console.log(`Último erro: ${info.last_error_message} (${new Date(info.last_error_date * 1000).toLocaleString("pt-BR")})`);
}
