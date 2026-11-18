import "server-only";
import { assistantConfig } from "@/lib/assistant/server/config";
import { handleAssistant, type ChatInput, type ChatReply, type Workspace } from "@/lib/assistant/server/engine";
import { HELP_TEXT } from "@/lib/assistant/format";
import type { AiParser } from "@/lib/assistant/providers/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { answerCallback, downloadFile, editMessage, sendMessage, sendTyping, TelegramError } from "./api";
import { decodeCallback, EDIT_HELP, encodeCallback, esc, parseCommand, parseUseSpace, renderReply } from "./render";
import { createUserClient, forgetUserSession } from "./session";
import { classify, type TgUpdate } from "./update";

export { classify, updateSchema, type TgUpdate } from "./update";

/*
 * ADAPTADOR DO TELEGRAM (ADR-0021): traduz update → motor de conversa
 * (handleAssistant, o MESMO do app) → mensagens. Nenhuma regra de negócio aqui.
 *   • Quem é o usuário: SÓ o vínculo do chat (channel_links), criado com código de uso único.
 *   • Dados: cliente com a sessão do próprio usuário (RLS), nunca a secret key.
 *   • Só chat privado: grupos são ignorados (ver ADR-0021).
 *   • Fotos/áudios: baixados para a memória, processados e descartados.
 *   • Logs: só metadados (update_id, tipo, status) — nunca o texto.
 */

const NOT_LINKED =
  "Olá! Eu sou o assistente do <b>Lar+</b>. Para usar por aqui, abra o app → <b>Configurações → Canais</b> → <b>Vincular Telegram</b> e toque no link (ou envie o código para mim).";

type Link = { id: string; user_id: string; default_workspace_id: string | null };
type Session = {
  link: Link; userId: string; supabase: Awaited<ReturnType<typeof createUserClient>>; workspaces: Workspace[]; active: Workspace;
  providers?: AiParser[];
};

const spaceName = (w: Workspace) => (w.kind === "personal" ? "Individual" : w.name);

async function openSession(link: Link): Promise<Session | null> {
  const supabase = await createUserClient(link.user_id);
  const { data } = await supabase.from("workspaces").select("id, kind, name").order("kind", { ascending: false });
  const workspaces = (data ?? []).map((w) => ({ id: w.id, kind: w.kind as Workspace["kind"], name: w.name }));
  if (!workspaces.length) return null;
  const active = workspaces.find((w) => w.id === link.default_workspace_id) ?? workspaces.find((w) => w.kind === "personal") ?? workspaces[0];
  return { link, userId: link.user_id, supabase, workspaces, active };
}

async function runEngine(s: Session, input: ChatInput): Promise<ChatReply[]> {
  try {
    return await handleAssistant(
      { supabase: s.supabase, userId: s.userId, channel: "telegram", activeWorkspaceId: s.active.id, workspaces: s.workspaces, providers: s.providers },
      input,
    );
  } catch (e) {
    console.error(`telegram: erro no motor (${e instanceof Error ? e.name : "erro"})`);
    return [{ text: "Tive um problema para processar. Tente de novo em instantes.", tone: "error" }];
  }
}

async function sendReplies(chatId: number, s: Session, replies: ChatReply[]) {
  for (const r of replies) {
    const { text, keyboard } = renderReply(r, spaceName(s.active));
    await sendMessage(chatId, text, keyboard);
  }
}

function workspaceKeyboard(s: Session) {
  return s.workspaces.map((w) => [{
    text: `${w.id === s.active.id ? "● " : ""}${spaceName(w)}`,
    callback_data: encodeCallback({ kind: "workspace", workspaceId: w.id }),
  }]);
}

async function setSpace(s: Session, ws: Workspace) {
  // RLS: o usuário só troca o espaço do PRÓPRIO vínculo e só para espaço de que é membro.
  const { error } = await s.supabase.from("channel_links").update({ default_workspace_id: ws.id }).eq("id", s.link.id);
  if (error) throw error;
  s.active = ws;
}

/** Processa um update já registrado (idempotência feita no webhook). */
export async function processUpdate(u: TgUpdate, deps: { providers?: AiParser[] } = {}): Promise<"done" | "ignored"> {
  const { kind, chatId, private: isPrivate } = classify(u);
  if (!chatId) return "ignored";
  // Só conversa privada: em grupo, o bot veria mensagens de pessoas não vinculadas.
  if (!isPrivate) return "ignored";

  const admin = createAdminClient();
  // Proteção contra flood: 20 mensagens/min por chat.
  const { data: allowed } = await admin.rpc("hit_rate_limit", { p_key: `tg:${chatId}`, p_window_seconds: 60, p_max: 20 });
  if (allowed === false) return "ignored";

  const { data: link } = await admin.from("channel_links")
    .select("id, user_id, default_workspace_id")
    .eq("channel", "telegram").eq("external_id", String(chatId)).maybeSingle();

  const text = u.message?.text?.trim() ?? "";
  const cmd = kind === "command" ? parseCommand(text) : null;

  // ---------------------------------------------------------------- vinculação
  if (cmd?.name === "start" && cmd.arg) {
    const code = cmd.arg.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 16);
    const label = [u.message?.from?.first_name, u.message?.from?.username && `@${u.message.from.username}`].filter(Boolean).join(" ").slice(0, 60) || null;
    const { data: linkId } = await admin.rpc("consume_channel_link_code", {
      p_channel: "telegram", p_code: code, p_external_id: String(chatId), p_display_label: label ?? undefined,
    });
    if (!linkId) {
      await sendMessage(chatId, "Código inválido ou expirado (vale 10 minutos). Gere outro no app em <b>Configurações → Canais</b>.");
      return "done";
    }
    await sendMessage(chatId, `Pronto! Este chat está ligado à sua conta do <b>Lar+</b> ✅\n\n${esc(HELP_TEXT)}\n\nUse /espaco para escolher onde gravar.`);
    return "done";
  }
  if (!link) {
    // Chat sem vínculo: só a instrução, nenhum dado.
    if (u.callback_query) await answerCallback(u.callback_query.id, "Este chat não está vinculado.");
    else await sendMessage(chatId, NOT_LINKED);
    return "done";
  }

  const s = await openSession(link);
  if (s) s.providers = deps.providers;
  if (!s) {
    await sendMessage(chatId, "Sua conta não tem nenhum espaço ativo. Abra o app para conferir.");
    return "done";
  }

  // ---------------------------------------------------------------- botões
  if (u.callback_query) {
    const cq = u.callback_query;
    const cb = decodeCallback(cq.data);
    const msg = cq.message;
    await answerCallback(cq.id);
    if (!cb || !msg) return "done";
    if (cb.kind === "workspace") {
      const ws = s.workspaces.find((w) => w.id === cb.workspaceId);
      if (ws) await setSpace(s, ws);
      await editMessage(chatId, msg.message_id, `Agora vou gravar em: <b>${esc(spaceName(s.active))}</b>`, workspaceKeyboard(s));
      return "done";
    }
    if (cb.kind === "unlink") {
      await s.supabase.from("channel_links").delete().eq("id", link.id);
      forgetUserSession(link.user_id);
      await editMessage(chatId, msg.message_id, "Chat desvinculado. Seus dados continuam no app; para usar aqui de novo, gere um novo código.");
      return "done";
    }
    if (cb.kind === "edit") {
      await sendMessage(chatId, EDIT_HELP);
      return "done";
    }
    const input: ChatInput = cb.kind === "confirm" ? { kind: "confirm", pendingId: cb.pendingId }
      : cb.kind === "cancel" ? { kind: "cancel", pendingId: cb.pendingId }
      : cb.kind === "undo" ? { kind: "undo", batchId: cb.batchId }
      : { kind: "chooseIndex", pendingId: cb.pendingId, index: cb.index };
    const replies = await runEngine(s, input);
    // A primeira resposta SUBSTITUI a mensagem com os botões (em vez de empilhar mensagens).
    const [first, ...rest] = replies;
    if (first) {
      const r = renderReply(first, spaceName(s.active));
      await editMessage(chatId, msg.message_id, r.text, r.keyboard);
    }
    await sendReplies(chatId, s, rest);
    return "done";
  }

  // ---------------------------------------------------------------- comandos
  if (cmd) {
    switch (cmd.name) {
      case "start":
      case "ajuda":
        await sendReplies(chatId, s, await runEngine(s, { kind: "text", text: "ajuda" }));
        await sendMessage(chatId, `📍 Gravando em: <b>${esc(spaceName(s.active))}</b> (mude com /espaco). Também entendo <b>foto de cupom</b> e <b>áudio</b>.`);
        return "done";
      case "resumo":
        await sendReplies(chatId, s, await runEngine(s, { kind: "text", text: "resumo do mês" }));
        return "done";
      case "desfazer":
        await sendReplies(chatId, s, await runEngine(s, { kind: "undo" }));
        return "done";
      case "espaco":
        await sendMessage(chatId, `Onde devo gravar? Agora: <b>${esc(spaceName(s.active))}</b>`, workspaceKeyboard(s));
        return "done";
      case "desvincular":
        await sendMessage(chatId, "Desligar este chat da sua conta? Você pode vincular de novo depois pelo app.", [[
          { text: "Sim, desvincular", callback_data: encodeCallback({ kind: "unlink" }) },
        ]]);
        return "done";
    }
  }

  // ---------------------------------------------------------------- "usar família"
  const want = parseUseSpace(text);
  if (want) {
    const ws = s.workspaces.find((w) => w.kind === want);
    if (!ws) {
      await sendMessage(chatId, want === "household" ? "Você ainda não participa de uma família no app." : "Espaço individual não encontrado.");
      return "done";
    }
    await setSpace(s, ws);
    await sendMessage(chatId, `Combinado: agora gravo em <b>${esc(spaceName(ws))}</b>.`);
    return "done";
  }

  // ---------------------------------------------------------------- texto, foto, voz
  await sendTyping(chatId);
  const m = u.message;
  if (kind === "text") {
    await sendReplies(chatId, s, await runEngine(s, { kind: "text", text }));
    return "done";
  }
  if (kind === "photo" && m) {
    // A maior versão até ~1600 px (o Telegram já manda redimensionada/comprimida).
    const sizes = [...(m.photo ?? [])].sort((a, b) => a.width * a.height - b.width * b.height);
    const pick = sizes.filter((p) => Math.max(p.width, p.height) <= 1600).pop() ?? sizes[0];
    const fileId = pick?.file_id ?? m.document?.file_id;
    if (!fileId) return "done";
    let file;
    try {
      file = await downloadFile(fileId, assistantConfig.maxImageBytes);
    } catch {
      await sendMessage(chatId, "Imagem grande demais. Mande como foto (não como arquivo) ou um print.");
      return "done";
    }
    const mimeType = m.document?.mime_type === "image/png" ? "image/png" : m.document?.mime_type === "image/webp" ? "image/webp" : "image/jpeg";
    await sendReplies(chatId, s, await runEngine(s, { kind: "image", mimeType, base64: file.base64 }));
    return "done";
  }
  if (kind === "voice" && m) {
    const v = m.voice ?? m.audio!;
    if (v.duration > assistantConfig.maxAudioSeconds) {
      await sendMessage(chatId, `Áudio longo demais (máx. ${assistantConfig.maxAudioSeconds} s). Mande um áudio curto.`);
      return "done";
    }
    let file;
    try {
      file = await downloadFile(v.file_id, assistantConfig.maxAudioBytes);
    } catch {
      await sendMessage(chatId, "Áudio grande demais. Mande um áudio mais curto.");
      return "done";
    }
    const mimeType = v.mime_type ?? "audio/ogg";
    const ext = file.path.split(".").pop() || "ogg";
    await sendReplies(chatId, s, await runEngine(s, { kind: "audio", mimeType, base64: file.base64, seconds: v.duration, filename: `voz.${ext}` }));
    return "done";
  }
  await sendMessage(chatId, "Posso ajudar com texto (“gastei 50 no mercado”), foto de cupom/comprovante ou áudio.");
  return "done";
}

/** Erros de envio do Telegram que não adianta repetir (bot bloqueado, chat apagado). */
export const isPermanentTelegramError = (e: unknown) => e instanceof TelegramError && (e.status === 403 || e.status === 400);
