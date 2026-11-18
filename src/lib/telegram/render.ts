import type { ChatReply } from "@/lib/assistant/server/engine";
import type { InlineKeyboard } from "./api";

/*
 * Tradução PURA (testável) entre o motor de conversa e o Telegram:
 *   resposta estruturada → texto HTML + teclado inline
 *   clique (callback_data, máx. 64 bytes) → ação
 * Nenhuma regra de negócio aqui.
 */

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type Callback =
  | { kind: "confirm"; pendingId: string }
  | { kind: "cancel"; pendingId: string }
  | { kind: "edit"; pendingId: string }
  | { kind: "option"; pendingId: string; index: number }
  | { kind: "undo"; batchId: string }
  | { kind: "workspace"; workspaceId: string }
  | { kind: "unlink" };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export function encodeCallback(c: Callback): string {
  switch (c.kind) {
    case "confirm": return `c:${c.pendingId}`;
    case "cancel": return `x:${c.pendingId}`;
    case "edit": return `e:${c.pendingId}`;
    case "option": return `o:${c.pendingId}:${c.index}`;
    case "undo": return `u:${c.batchId}`;
    case "workspace": return `w:${c.workspaceId}`;
    case "unlink": return "unlink";
  }
}

export function decodeCallback(data: string | undefined): Callback | null {
  if (!data || data.length > 64) return null;
  let m: RegExpExecArray | null;
  if (data === "unlink") return { kind: "unlink" };
  if ((m = new RegExp(`^([cxe]):(${UUID})$`).exec(data))) {
    return { kind: m[1] === "c" ? "confirm" : m[1] === "x" ? "cancel" : "edit", pendingId: m[2] };
  }
  if ((m = new RegExp(`^o:(${UUID}):(\\d{1,2})$`).exec(data))) return { kind: "option", pendingId: m[1], index: Number(m[2]) };
  if ((m = new RegExp(`^u:(${UUID})$`).exec(data))) return { kind: "undo", batchId: m[1] };
  if ((m = new RegExp(`^w:(${UUID})$`).exec(data))) return { kind: "workspace", workspaceId: m[1] };
  return null;
}

const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100).replace(/ /g, " ");

export type Rendered = { text: string; keyboard: InlineKeyboard };

/** Uma resposta do motor → uma mensagem do Telegram. `space` = onde grava. */
export function renderReply(r: ChatReply, space: string): Rendered {
  const parts: string[] = [];
  const keyboard: InlineKeyboard = [];
  if (r.card) {
    if (r.card.media) parts.push(esc(r.card.media.summary));
    parts.push(`<b>${esc(r.card.reason || r.text)}</b>`);
    for (const it of r.card.items) {
      const n = r.card.items.length > 1 ? `${it.index + 1}. ` : "";
      parts.push(`${n}<b>${esc(it.title)}</b> — ${money(it.amountCents)}\n${it.lines.map((l) => `   ${esc(l)}`).join("\n")}`);
    }
    keyboard.push([
      { text: "✅ Confirmar", callback_data: encodeCallback({ kind: "confirm", pendingId: r.card.pendingId }) },
      { text: "✏️ Editar", callback_data: encodeCallback({ kind: "edit", pendingId: r.card.pendingId }) },
      { text: "✖️ Cancelar", callback_data: encodeCallback({ kind: "cancel", pendingId: r.card.pendingId }) },
    ]);
    (r.card.extras ?? []).forEach((o, index) =>
      keyboard.push([{ text: o.label.slice(0, 60), callback_data: encodeCallback({ kind: "option", pendingId: r.card!.pendingId, index }) }]));
    parts.push(`<i>📍 Vai gravar em: ${esc(r.card.workspaceName)}</i>`);
  } else {
    parts.push(r.tone === "success" ? `✅ ${esc(r.text)}` : esc(r.text));
    if (r.done?.lines.length) parts.push(r.done.lines.map((l) => `• ${esc(l)}`).join("\n"));
    if (r.question?.options?.length) {
      r.question.options.slice(0, 8).forEach((o, index) =>
        keyboard.push([{ text: `${index + 1}. ${o.label}`.slice(0, 60), callback_data: encodeCallback({ kind: "option", pendingId: r.question!.pendingId, index }) }]));
      keyboard.push([{ text: "✖️ Cancelar", callback_data: encodeCallback({ kind: "cancel", pendingId: r.question.pendingId }) }]);
    }
    if (r.done?.undoable) {
      keyboard.push([{ text: "↩️ Desfazer", callback_data: encodeCallback({ kind: "undo", batchId: r.done.batchId }) }]);
      parts.push(`<i>📍 Espaço: ${esc(space)}</i>`);
    }
  }
  return { text: parts.join("\n\n").slice(0, 4000), keyboard };
}

export const EDIT_HELP =
  "Para corrigir, responda com o que mudar:\n• <code>valor 45,90</code>\n• <code>categoria Mercado</code>\n• <code>data ontem</code>\n• <code>descrição Padaria</code>\nCom vários itens: <code>item 2 valor 30</code>. Depois toque em ✅ Confirmar.";

export type Command = { name: "start" | "ajuda" | "resumo" | "desfazer" | "espaco" | "desvincular"; arg: string } | null;

/** "/start ABC123" · "/ajuda@LarMaisBot" → comando. */
export function parseCommand(text: string): Command {
  const m = /^\/(start|ajuda|help|resumo|desfazer|espaco|espaço|desvincular)(?:@\w+)?(?:\s+(.*))?$/i.exec(text.trim());
  if (!m) return null;
  const raw = m[1].toLowerCase();
  const name = raw === "help" ? "ajuda" : raw === "espaço" ? "espaco" : raw;
  return { name: name as NonNullable<Command>["name"], arg: (m[2] ?? "").trim() };
}

/** "usar família" / "usar individual" (com ou sem acento). */
export function parseUseSpace(text: string): "household" | "personal" | null {
  const t = text.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/^(usar|use|mudar para|trocar para) (a )?(familia|casa)$/.test(t)) return "household";
  if (/^(usar|use|mudar para|trocar para) (o )?(individual|pessoal|meu)$/.test(t)) return "personal";
  return null;
}

export const COMMANDS = [
  { command: "ajuda", description: "Exemplos do que posso fazer" },
  { command: "resumo", description: "Resumo do mês" },
  { command: "desfazer", description: "Desfaz o último registro" },
  { command: "espaco", description: "Escolher onde gravar (individual/família)" },
  { command: "desvincular", description: "Desligar este chat da sua conta" },
];
