import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MockParser } from "@/lib/assistant/providers/mock";
import type { Database } from "@/lib/supabase/database.types";
import { tgCallback, tgGroupText, tgPhoto, tgText, tgVoice } from "./fixtures";

/*
 * INTEGRAÇÃO DO TELEGRAM: webhook → adaptador → motor → banco (Supabase local, RLS real).
 * A Bot API é SIMULADA (fetch interceptado); IA = MockParser (sem rede, sem chave).
 * Usuário: bruno@teste.local; tudo que é criado é apagado no final.
 */

function env(name: string) {
  if (process.env[name]) return process.env[name]!;
  try {
    const line = readFileSync(".env.local", "utf8").split("\n").find((l) => l.startsWith(`${name}=`));
    return line?.slice(name.length + 1).trim() ?? "";
  } catch {
    return "";
  }
}

const SECRET = "test_webhook_secret_0123456789abcdef";
// Chat novo a cada execução: o limite de 20 msgs/min por chat (anti-flood) não vaza entre execuções.
const CHAT = 5_000_000 + Math.floor(Math.random() * 4_000_000);
const PHOTO_BYTES = Buffer.from("RECIBO-TESTE-Lar+");
const VOICE_BYTES = Buffer.from("VOZ-TESTE-Lar+");
const RECEIPT_KEY = PHOTO_BYTES.toString("base64").slice(0, 12);
const VOICE_KEY = VOICE_BYTES.toString("base64").slice(0, 12);

type Sent = { method: string; body: Record<string, unknown> };
const sent: Sent[] = [];
let msgSeq = 100;
let nextFile: Buffer = PHOTO_BYTES;

const realFetch = globalThis.fetch;
vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (!url.startsWith("https://api.telegram.org/")) return realFetch(input, init);
  if (url.includes("/file/bot")) return new Response(new Uint8Array(nextFile));
  const method = url.split("/").pop()!;
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  sent.push({ method, body });
  const result = method === "getFile" ? { file_path: nextFile === VOICE_BYTES ? "voice/file_7.oga" : "photos/file_3.jpg", file_size: nextFile.length }
    : method === "sendMessage" ? { message_id: ++msgSeq } : true;
  return Response.json({ ok: true, result });
});

const ai = new MockParser({}, true, {
  receipts: {
    [RECEIPT_KEY]: {
      is_receipt: true, legible: true, doc_type: "nfce", merchant: "Supermercado Bom Preço CNPJ 12.345.678/0001-90",
      total: 87.4, date: null, payment: "debit",
      items: [
        { description: "Arroz", amount: 28.9, category: "Mercado" },
        { description: "Dipirona", amount: 12.5, category: "Saúde" },
        { description: "Leite", amount: 46, category: "Mercado" },
      ],
    },
  },
  transcripts: { [VOICE_KEY]: "gastei 35 no ifood" },
});

let webhook: typeof import("../webhook").handleTelegramWebhook;
let sb: SupabaseClient<Database>;
let userId = "";
let ws = "";
const startedAt = new Date().toISOString();

async function post(update: unknown, secret = SECRET) {
  const tasks: Promise<void>[] = [];
  const res = await webhook(
    new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret },
      body: JSON.stringify(update),
    }),
    (t) => void tasks.push(t()),
    { providers: [ai] },
  );
  await Promise.all(tasks);
  if (process.env.DEBUG_TG) console.log("webhook", res.status, await res.clone().text());
  return res;
}
const texts = () => sent.filter((s) => s.method === "sendMessage" || s.method === "editMessageText").map((s) => String(s.body.text));
const lastKeyboard = () => {
  const m = [...sent].reverse().find((s) => s.body.reply_markup);
  return (m?.body.reply_markup as { inline_keyboard: { text: string; callback_data?: string }[][] } | undefined)?.inline_keyboard ?? [];
};
const button = (label: RegExp) => lastKeyboard().flat().find((b) => label.test(b.text))?.callback_data ?? "";

beforeAll(async () => {
  process.env.TELEGRAM_BOT_TOKEN = "123456789:TEST_token_abcdefghijklmnopqrstuvwxyz0123";
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
  // Chave secreta PADRÃO do Supabase local (pública na documentação do CLI; não serve em produção).
  process.env.SUPABASE_SECRET_KEY = env("SUPABASE_SECRET_KEY") || "";
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= env("NEXT_PUBLIC_SUPABASE_URL") || "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||= env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  process.env.NEXT_PUBLIC_SITE_URL ||= "http://localhost:3000";
  webhook = (await import("../webhook")).handleTelegramWebhook;

  sb = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: "bruno@teste.local", password: "Teste12345" });
  if (error) throw error;
  userId = data.user.id;
  ws = (await sb.from("workspaces").select("id").eq("owner_id", userId).eq("kind", "personal").single()).data!.id;
  await sb.from("accounts").insert({ workspace_id: ws, name: "Conta Principal", initial_balance_cents: 100000 });
}, 30_000);

afterAll(async () => {
  if (!sb || !ws) return;
  await sb.from("assistant_actions").delete().eq("workspace_id", ws);
  await sb.from("assistant_sessions").delete().eq("user_id", userId);
  await sb.from("transactions").delete().eq("workspace_id", ws);
  await sb.from("accounts").delete().eq("workspace_id", ws);
  await sb.from("channel_links").delete().eq("user_id", userId);
  // Códigos de vinculação (limite de 10/hora) só são acessíveis ao servidor.
  const admin = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  await admin.from("channel_link_codes").delete().eq("user_id", userId);
  await admin.from("rate_limits").delete().like("key", `tg:${CHAT}`);
  await admin.from("telegram_updates").delete().eq("chat_id", CHAT);
  // Ações do assistente são auditoria (o usuário não apaga) → limpeza só pelo servidor.
  await admin.from("assistant_actions").delete().eq("workspace_id", ws);
  vi.unstubAllGlobals();
});

describe("webhook do Telegram", () => {
  it("secret_token inválido ou ausente → 401, nada processado", async () => {
    expect((await post(tgText(CHAT, "oi"), "errado_errado_errado_errado")).status).toBe(401);
    expect((await post(tgText(CHAT, "oi"), "")).status).toBe(401);
    expect(sent).toHaveLength(0);
  });

  it("chat NÃO vinculado recebe só a instrução (nenhum dado)", async () => {
    await post(tgText(CHAT, "quanto gastei esse mês?"));
    expect(texts().at(-1)).toMatch(/Configurações → Canais/);
    expect(texts().at(-1)).not.toMatch(/R\$/);
  });

  it("grupo é ignorado (sem resposta)", async () => {
    const before = sent.length;
    await post(tgGroupText(-1001234, "gastei 50 no uber"));
    expect(sent.length).toBe(before);
  });

  it("vincula com código de uso único (deep link /start CÓDIGO)", async () => {
    const { data: code } = await sb.rpc("create_channel_link_code", { p_channel: "telegram" });
    await post(tgText(CHAT, `/start ${code}`));
    expect(texts().at(-1)).toMatch(/Pronto! Este chat está ligado/);
    const { data: link } = await sb.from("channel_links").select("external_id, default_workspace_id").eq("user_id", userId).single();
    expect(link).toEqual({ external_id: String(CHAT), default_workspace_id: ws });
    await post(tgText(CHAT, `/start ${code}`));
    expect(texts().at(-1)).toMatch(/Código inválido ou expirado/);
  });

  it("idempotência: o mesmo update_id reenviado não processa duas vezes", async () => {
    const u = tgText(CHAT, "gastei 50 no uber");
    await post(u);
    const before = sent.length;
    const again = await post(u);
    expect(await again.json()).toEqual({ ok: true, duplicate: true });
    expect(sent.length).toBe(before);
    const { count } = await sb.from("transactions").select("*", { count: "exact", head: true }).eq("workspace_id", ws);
    expect(count).toBe(1);
  });

  it("texto grava pelo motor (origem telegram + mensagem original) e mostra o espaço", async () => {
    expect(texts().at(-1)).toMatch(/Gravado[\s\S]*Uber[\s\S]*📍 Espaço: Individual/);
    const act = await sb.from("assistant_actions").select("channel, input_kind, original_text").eq("workspace_id", ws).gte("created_at", startedAt).single();
    expect(act.data).toEqual({ channel: "telegram", input_kind: "text", original_text: "gastei 50 no uber" });
  });

  it("botão ↩️ Desfazer edita a mensagem e apaga o lançamento", async () => {
    const undo = button(/Desfazer/);
    expect(undo).toMatch(/^u:/);
    await post(tgCallback(CHAT, undo));
    expect(sent.at(-1)!.method).toBe("editMessageText");
    expect(texts().at(-1)).toMatch(/Desfeito/);
    const { count } = await sb.from("transactions").select("*", { count: "exact", head: true }).eq("workspace_id", ws);
    expect(count).toBe(0);
  });

  it("foto: lê o cupom (sem CNPJ), SEMPRE pede confirmação, divide por categoria e grava com origem foto", async () => {
    nextFile = PHOTO_BYTES;
    await post(tgPhoto(CHAT));
    expect(sent.some((s) => s.method === "getFile" && s.body.file_id === "AgACAgEAAxkBAAIBc2_xl")).toBe(true); // maior até 1600 px
    expect(texts().at(-1)).toMatch(/📷 Li: Nota fiscal \(NFC-e\) · Supermercado Bom Preço/);
    expect(texts().at(-1)).not.toMatch(/12\.345\.678/);
    expect(button(/Dividir por categoria/)).toMatch(/^o:/);
    let { count } = await sb.from("transactions").select("*", { count: "exact", head: true }).eq("workspace_id", ws);
    expect(count).toBe(0); // nada gravado sem confirmação

    await post(tgCallback(CHAT, button(/Dividir por categoria/)));
    expect(texts().at(-1)).toMatch(/1\. [\s\S]*2\. /);
    await post(tgCallback(CHAT, button(/Confirmar/)));
    expect(texts().at(-1)).toMatch(/2 lançamentos gravados/);
    const rows = await sb.from("transactions").select("amount_cents, category:categories(name)").eq("workspace_id", ws).order("amount_cents");
    expect(rows.data!.map((r) => [r.amount_cents, r.category?.name])).toEqual([[1250, "Saúde"], [7490, "Mercado"]]);
    const acts = await sb.from("assistant_actions").select("input_kind, original_text").eq("workspace_id", ws).eq("input_kind", "photo").gte("created_at", startedAt);
    expect(acts.data).toHaveLength(2);
    expect(acts.data![0].original_text).toMatch(/^\[foto\] Nota fiscal \(NFC-e\) · Supermercado Bom Preço · R\$/);
    ({ count } = await sb.from("transactions").select("*", { count: "exact", head: true }).eq("workspace_id", ws));
    expect(count).toBe(2);
  });

  it("voz: transcreve, mostra “Entendi: …” e segue o fluxo normal (origem áudio)", async () => {
    nextFile = VOICE_BYTES;
    await post(tgVoice(CHAT, 4));
    const out = texts().slice(-2).join("\n");
    expect(out).toMatch(/Entendi: “gastei 35 no ifood”/);
    expect(out).toMatch(/Gravado/);
    const act = await sb.from("assistant_actions").select("input_kind, original_text").eq("workspace_id", ws).eq("input_kind", "audio").gte("created_at", startedAt).single();
    expect(act.data).toEqual({ input_kind: "audio", original_text: "gastei 35 no ifood" });
  });

  it("áudio longo demais é recusado antes de baixar", async () => {
    const before = sent.filter((s) => s.method === "getFile").length;
    await post(tgVoice(CHAT, 300));
    expect(texts().at(-1)).toMatch(/Áudio longo demais/);
    expect(sent.filter((s) => s.method === "getFile").length).toBe(before);
  });

  it("/espaco lista os espaços; “usar família” sem família avisa", async () => {
    await post(tgText(CHAT, "/espaco"));
    expect(texts().at(-1)).toMatch(/Onde devo gravar\? Agora: <b>Individual<\/b>/);
    expect(lastKeyboard().flat()[0].callback_data).toBe(`w:${ws}`);
    await post(tgText(CHAT, "usar família"));
    expect(texts().at(-1)).toMatch(/ainda não participa de uma família/);
  });

  it("/desvincular pede confirmação e o botão remove o vínculo", async () => {
    await post(tgText(CHAT, "/desvincular"));
    await post(tgCallback(CHAT, button(/Sim, desvincular/)));
    expect(texts().at(-1)).toMatch(/Chat desvinculado/);
    const { count } = await sb.from("channel_links").select("*", { count: "exact", head: true }).eq("user_id", userId);
    expect(count).toBe(0);
    await post(tgText(CHAT, "gastei 10 no pão"));
    expect(texts().at(-1)).toMatch(/Configurações → Canais/);
  });
});
