"use server";

import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";
import { createClient } from "@/lib/supabase/server";

/*
 * Canais (Fase 6, ADR-0021): vincular o Telegram com código de uso único
 * (10 min, gerado no banco; só o hash fica salvo) + QR + deep link.
 * Um chat por usuário; desvincular aqui ou pelo /desvincular no bot.
 */

export type LinkCode = { code: string; deepLink: string; qrSvg: string; expiresAt: string };

export async function createTelegramLinkAction(): Promise<ActionState<LinkCode>> {
  await requireUser();
  const supabase = await createClient();
  const { data: code, error } = await supabase.rpc("create_channel_link_code", { p_channel: "telegram" });
  if (error || !code) {
    return fail(error?.code === "54000" ? "Muitos códigos gerados. Tente de novo mais tarde." : "Não foi possível gerar o código.");
  }
  const deepLink = `https://t.me/${serverEnv.TELEGRAM_BOT_USERNAME}?start=${code}`;
  const qrSvg = await QRCode.toString(deepLink, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0b0d13", light: "#ffffff" } });
  return ok(undefined, { code, deepLink, qrSvg, expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() });
}

export async function unlinkTelegramAction(): Promise<ActionState<never>> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("channel_links").delete().eq("user_id", user.id).eq("channel", "telegram");
  if (error) return fail("Não foi possível desvincular.");
  revalidatePath("/configuracoes/canais");
  return ok("Telegram desvinculado.");
}

export async function setChannelSpaceAction(workspaceId: string): Promise<ActionState<never>> {
  const parsed = z.uuid().safeParse(workspaceId);
  if (!parsed.success) return fail("Espaço inválido.");
  const user = await requireUser();
  const supabase = await createClient();
  // RLS: só o próprio vínculo e só espaço de que a pessoa é membro.
  const { error } = await supabase.from("channel_links").update({ default_workspace_id: parsed.data })
    .eq("user_id", user.id).eq("channel", "telegram");
  if (error) return fail("Não foi possível trocar o espaço.");
  revalidatePath("/configuracoes/canais");
  return ok("Espaço do Telegram atualizado.");
}
