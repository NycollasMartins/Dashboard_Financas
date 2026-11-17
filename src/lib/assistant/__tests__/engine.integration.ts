import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { MockParser } from "../providers/mock";
import { handleAssistant, type ChatInput, type EngineCtx } from "../server/engine";

/*
 * INTEGRAÇÃO: mensagem → motor → APIs internas → banco (Supabase local, RLS real).
 * Usa o usuário bruno@teste.local (espaço individual, sem dados do seed) e
 * apaga tudo o que criou no final. Rodar: pnpm test:integration (precisa do db:start).
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

let sb: SupabaseClient<Database>;
let ctx: EngineCtx;
let ws: string;
const ids = { account: "", card: "", goal: "" };

async function say(text: string, providers: MockParser[] = []) {
  return handleAssistant({ ...ctx, providers }, { kind: "text", text });
}
async function send(input: ChatInput) {
  return handleAssistant({ ...ctx, providers: [] }, input);
}

beforeAll(async () => {
  sb = createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL") || "http://127.0.0.1:54321", env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false },
  });
  const { data, error } = await sb.auth.signInWithPassword({ email: "bruno@teste.local", password: "Teste12345" });
  if (error) throw error;
  const userId = data.user.id;
  const w = await sb.from("workspaces").select("id").eq("owner_id", userId).eq("kind", "personal").single();
  ws = w.data!.id;
  ids.account = (await sb.from("accounts").insert({ workspace_id: ws, name: "Conta Principal", initial_balance_cents: 100000 }).select("id").single()).data!.id;
  ids.card = (await sb.from("credit_cards").insert({ workspace_id: ws, name: "Roxinho", closing_day: 3, due_day: 10, limit_cents: 500000 }).select("id").single()).data!.id;
  ids.goal = (await sb.from("goals").insert({ workspace_id: ws, name: "Viagem", target_cents: 500000 }).select("id").single()).data!.id;
  ctx = { supabase: sb, userId, channel: "app", activeWorkspaceId: ws, workspaces: [{ id: ws, kind: "personal", name: "Bruno" }] };
}, 30_000);

afterAll(async () => {
  if (!sb || !ws) return;
  await sb.from("assistant_actions").delete().eq("workspace_id", ws);
  await sb.from("assistant_sessions").delete().eq("user_id", ctx.userId);
  await sb.from("category_rules").delete().eq("workspace_id", ws);
  await sb.from("goal_contributions").delete().eq("workspace_id", ws);
  await sb.from("transactions").delete().eq("workspace_id", ws);
  await sb.from("installment_plans").delete().eq("workspace_id", ws);
  await sb.from("goals").delete().eq("workspace_id", ws);
  await sb.from("credit_cards").delete().eq("workspace_id", ws);
  await sb.from("accounts").delete().eq("workspace_id", ws);
});

describe("assistente — fluxo completo no banco", () => {
  it("“gastei 50 no uber” grava direto, com origem e mensagem original, e “desfazer” apaga", async () => {
    const [r] = await say("gastei 50 no uber");
    expect(r.done?.lines[0]).toMatch(/R\$\s50,00 · Uber \(Transporte/);
    const tx = await sb.from("transactions").select("id, amount_cents, source, category:categories(name)").eq("workspace_id", ws).single();
    expect(tx.data).toMatchObject({ amount_cents: 5000, source: "assistant", category: { name: "Transporte" } });
    const act = await sb.from("assistant_actions").select("original_text, provider, record_id").eq("record_id", tx.data!.id).single();
    expect(act.data).toMatchObject({ original_text: "gastei 50 no uber", provider: "local" });

    const [u] = await say("desfazer");
    expect(u.text).toMatch(/Desfeito/);
    expect((await sb.from("transactions").select("id").eq("workspace_id", ws)).data).toHaveLength(0);
  });

  it("vários lançamentos → cartão de confirmação → confirmar grava os dois; desfazer apaga o lote", async () => {
    const [r] = await say("gastei 30 no uber e 80 no mercado");
    expect(r.card?.items.map((i) => i.amountCents)).toEqual([3000, 8000]);
    expect((await sb.from("transactions").select("id").eq("workspace_id", ws)).data).toHaveLength(0); // nada antes de confirmar
    const [c] = await send({ kind: "confirm", pendingId: r.card!.pendingId });
    expect(c.done?.lines).toHaveLength(2);
    expect((await sb.from("transactions").select("id").eq("workspace_id", ws)).data).toHaveLength(2);
    await send({ kind: "undo", batchId: c.done!.batchId });
    expect((await sb.from("transactions").select("id").eq("workspace_id", ws)).data).toHaveLength(0);
  });

  it("valor acima do limite pede confirmação; parcelada gera as parcelas no único cartão; desfazer apaga o plano", async () => {
    const [r] = await say("comprei uma tv de 3000 em 10x");
    expect(r.card?.reason).toMatch(/Valor acima/);
    const [c] = await send({ kind: "confirm", pendingId: r.card!.pendingId });
    expect(c.tone).toBe("success");
    const parcelas = await sb.from("transactions").select("installment_number, card_id, source").eq("workspace_id", ws);
    expect(parcelas.data).toHaveLength(10);
    expect(parcelas.data!.every((p) => p.card_id === ids.card && p.source === "assistant")).toBe(true);
    await say("desfazer");
    expect((await sb.from("transactions").select("id").eq("workspace_id", ws)).data).toHaveLength(0);
  });

  it("guardar e retirar de meta (pergunta o motivo por texto, como no WhatsApp)", async () => {
    const [g] = await say("guardei 300 pra viagem");
    expect(g.tone).toBe("success");
    const [q] = await say("tirei 100 da viagem");
    expect(q.text).toMatch(/motivo/);
    const [w] = await say("comprar passagem antes");
    expect(w.tone).toBe("success");
    const contribs = await sb.from("goal_contributions").select("amount_cents, note, source").eq("goal_id", ids.goal).order("amount_cents");
    expect(contribs.data).toEqual([
      { amount_cents: -10000, note: "comprar passagem antes", source: "assistant" },
      { amount_cents: 30000, note: null, source: "assistant" },
    ]);
    // Guardar não é despesa
    expect((await sb.from("transactions").select("id").eq("workspace_id", ws)).data).toHaveLength(0);
  });

  it("aprende a categoria corrigida e usa na próxima vez", async () => {
    const [r] = await say("dei 40 pro flanelinha");
    expect(r.card).toBeTruthy(); // sem categoria → pede confirmação
    const transporte = r.card!.categories.find((c) => c.name === "Transporte")!;
    await send({ kind: "confirm", pendingId: r.card!.pendingId, edits: [{ index: 0, categoryId: transporte.id }] });
    const rule = await sb.from("category_rules").select("pattern").eq("workspace_id", ws).single();
    expect(rule.data?.pattern).toBe("flanelinha");
    const [again] = await say("dei 15 pro flanelinha");
    expect(again.done?.lines[0]).toMatch(/Transporte/);
  });

  it("consultas são calculadas pelo banco", async () => {
    const [r] = await say("quanto gastei com transporte?");
    expect(r.text).toMatch(/Você gastou R\$\s\d.* com Transporte/);
    const [s] = await say("qual meu saldo");
    expect(s.text).toMatch(/Saldo das contas: R\$/);
    const [m] = await say("como ta a meta da viagem");
    expect(m.text).toMatch(/Viagem: R\$\s200,00 de R\$\s5\.000,00/);
  });

  it("caminho da IA (provedor simulado): resultado sempre passa por confirmação", async () => {
    const ai = new MockParser({
      "coisinha de 12 reais na lojinha": { items: [{ intent: "registrar_despesa", amount: 12, description: "Lojinha", category: "Compras" }] },
    });
    const [r] = await say("coisinha de 12 reais na lojinha", [ai]);
    expect(ai.calls).toHaveLength(1);
    expect(r.card?.reason).toMatch(/IA/);
    expect(r.card?.items[0]).toMatchObject({ title: "Lojinha", amountCents: 1200 });
    await send({ kind: "cancel", pendingId: r.card!.pendingId });
  });

  it("“paguei a luz” sem previsto avisa; confirma quando existe", async () => {
    const [none] = await say("paguei a luz");
    expect(none.text).toMatch(/Não achei/);
    await sb.from("transactions").insert({
      workspace_id: ws, kind: "expense", amount_cents: 18000, description: "Luz", occurred_on: new Date().toISOString().slice(0, 10),
      payment_method: "pix", account_id: ids.account, is_settled: false,
    });
    const [ok] = await say("paguei a luz");
    expect(ok.text).toMatch(/Luz · R\$\s180,00 marcado como pago/);
    await say("desfazer");
    const luz = await sb.from("transactions").select("is_settled").eq("description", "Luz").eq("workspace_id", ws).single();
    expect(luz.data?.is_settled).toBe(false);
  });
});
