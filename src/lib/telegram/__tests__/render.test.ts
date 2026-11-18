import { describe, expect, it } from "vitest";
import type { ChatReply } from "@/lib/assistant/server/engine";
import { classify, updateSchema } from "../update";
import { decodeCallback, encodeCallback, parseCommand, parseUseSpace, renderReply } from "../render";
import { tgCallback, tgGroupText, tgPhoto, tgText, tgVoice } from "./fixtures";

const P = "0f0e0d0c-0b0a-4908-8706-050403020100";

describe("payloads reais do Telegram", () => {
  it("texto, comando, foto, voz, botão e grupo são classificados", () => {
    const k = (u: unknown) => classify(updateSchema.parse(u));
    expect(k(tgText(1, "gastei 50"))).toEqual({ kind: "text", chatId: 1, private: true });
    expect(k(tgText(1, "/start ABC"))).toMatchObject({ kind: "command" });
    expect(k(tgPhoto(1))).toMatchObject({ kind: "photo" });
    expect(k(tgVoice(1))).toMatchObject({ kind: "voice" });
    expect(k(tgCallback(1, `c:${P}`))).toMatchObject({ kind: "callback", private: true });
    expect(k(tgGroupText(-100, "oi"))).toMatchObject({ private: false });
  });
});

describe("callback_data (máx. 64 bytes)", () => {
  it("ida e volta de todas as ações", () => {
    for (const c of [
      { kind: "confirm", pendingId: P }, { kind: "cancel", pendingId: P }, { kind: "edit", pendingId: P },
      { kind: "option", pendingId: P, index: 3 }, { kind: "undo", batchId: P }, { kind: "workspace", workspaceId: P }, { kind: "unlink" },
    ] as const) {
      const data = encodeCallback(c);
      expect(data.length).toBeLessThanOrEqual(64);
      expect(decodeCallback(data)).toEqual(c);
    }
  });
  it("lixo ou dado forjado é ignorado", () => {
    expect(decodeCallback("c:nao-e-uuid")).toBeNull();
    expect(decodeCallback("drop table")).toBeNull();
    expect(decodeCallback(undefined)).toBeNull();
  });
});

describe("comandos e troca de espaço", () => {
  it("comandos com e sem @bot e argumento", () => {
    expect(parseCommand("/start AB12CD34")).toEqual({ name: "start", arg: "AB12CD34" });
    expect(parseCommand("/ajuda@LarMaisBot")).toEqual({ name: "ajuda", arg: "" });
    expect(parseCommand("/espaço")).toEqual({ name: "espaco", arg: "" });
    expect(parseCommand("/help")).toEqual({ name: "ajuda", arg: "" });
    expect(parseCommand("/qualquer")).toBeNull();
  });
  it("“usar família” / “usar individual”", () => {
    expect(parseUseSpace("usar família")).toBe("household");
    expect(parseUseSpace("Usar individual")).toBe("personal");
    expect(parseUseSpace("usar o cartão")).toBeNull();
  });
});

describe("renderização das respostas", () => {
  it("cartão: botões Confirmar/Editar/Cancelar + extra, e o espaço onde vai gravar", () => {
    const r: ChatReply = {
      text: "Confira", tone: "info",
      card: {
        pendingId: P, reason: "Li esta foto — confira antes de gravar.", workspaceName: "Família Silva",
        items: [{ index: 0, title: "Mercado <Bom>", amountCents: 8740, kind: "expense", lines: ["Mercado", "hoje"], categoryId: null, categoryKind: "expense", date: "2026-11-17" }],
        categories: [], media: { summary: "📷 Li: Cupom", warnings: [] }, extras: [{ label: "Dividir por categoria", value: "split" }],
      },
    };
    const out = renderReply(r, "Individual");
    expect(out.text).toContain("Mercado &lt;Bom&gt;"); // HTML escapado
    expect(out.text).toContain("📍 Vai gravar em: Família Silva");
    expect(out.keyboard[0].map((b) => b.text)).toEqual(["✅ Confirmar", "✏️ Editar", "✖️ Cancelar"]);
    expect(out.keyboard[1][0].callback_data).toBe(`o:${P}:0`);
  });
  it("gravado: linhas, botão Desfazer e o espaço", () => {
    const out = renderReply({ text: "Gravado.", tone: "success", done: { batchId: P, lines: ["R$ 50,00 · Uber"], undoable: true } }, "Individual");
    expect(out.text).toBe("✅ Gravado.\n\n• R$ 50,00 · Uber\n\n<i>📍 Espaço: Individual</i>");
    expect(out.keyboard).toEqual([[{ text: "↩️ Desfazer", callback_data: `u:${P}` }]]);
  });
  it("pergunta: opções numeradas + cancelar", () => {
    const out = renderReply({ text: "Cartão ou conta?", question: { pendingId: P, options: [{ label: "Cartão Nubank", value: "a" }, { label: "Conta Nubank", value: "b" }] } }, "x");
    expect(out.keyboard.map((r) => r[0].text)).toEqual(["1. Cartão Nubank", "2. Conta Nubank", "✖️ Cancelar"]);
  });
});
