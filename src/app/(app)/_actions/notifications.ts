"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth/session";
import { KIND_VALUES } from "@/lib/notifications/kinds";
import { pushConfigured, sendPush } from "@/lib/notifications/push";
import { createClient } from "@/lib/supabase/server";

/*
 * Notificações (Fase 6, ADR-0023): assinatura de push por aparelho, preferências
 * por tipo e canal, horário de silêncio e a central (lidas/não lidas).
 * Tudo com o cliente do usuário → RLS (cada um só mexe no que é seu).
 */

const subSchema = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
  deviceLabel: z.string().max(80).optional(),
});

export async function savePushSubscriptionAction(raw: unknown): Promise<ActionState<never>> {
  const parsed = subSchema.safeParse(raw);
  if (!parsed.success) return fail("Assinatura de notificação inválida.");
  await requireUser();
  const supabase = await createClient();
  const s = parsed.data;
  // Mesmo aparelho assinando de novo (troca de conta, nova chave) → substitui.
  await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, device_label: s.deviceLabel ?? null,
  });
  if (error) return fail("Não foi possível ativar as notificações neste aparelho.");
  revalidatePath("/configuracoes/notificacoes");
  return ok("Notificações ativadas neste aparelho.");
}

export async function removePushSubscriptionAction(endpoint: string): Promise<ActionState<never>> {
  const parsed = z.string().max(1000).safeParse(endpoint);
  if (!parsed.success) return fail("Inválido.");
  await requireUser();
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data);
  revalidatePath("/configuracoes/notificacoes");
  return ok("Notificações desativadas neste aparelho.");
}

/** Envia um push de teste para os aparelhos da PRÓPRIA pessoa. */
export async function sendTestPushAction(): Promise<ActionState<never>> {
  await requireUser();
  if (!pushConfigured()) return fail("Push não configurado no servidor (chaves VAPID).");
  const supabase = await createClient();
  const { data: subs } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");
  if (!subs?.length) return fail("Nenhum aparelho com notificações ativadas.");
  let sent = 0;
  for (const s of subs) {
    const r = await sendPush(s, { title: "Lar+ · teste", body: "Se você está lendo isto, as notificações funcionam 🎉", url: "/notificacoes", tag: "teste" });
    if (r === "sent") sent++;
    if (r === "gone") await supabase.from("push_subscriptions").delete().eq("id", s.id);
  }
  return sent ? ok(`Teste enviado para ${sent} aparelho(s).`) : fail("Não consegui entregar. Ative de novo neste aparelho.");
}

const prefSchema = z.object({
  kind: z.enum(KIND_VALUES),
  enabled: z.boolean(),
  push: z.boolean(),
  telegram: z.boolean(),
});

export async function setNotificationPrefAction(raw: unknown): Promise<ActionState<never>> {
  const parsed = prefSchema.safeParse(raw);
  if (!parsed.success) return fail("Preferência inválida.");
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("notification_prefs").upsert({ user_id: user.id, ...parsed.data }, { onConflict: "user_id,kind" });
  if (error) return fail("Não foi possível salvar.");
  return ok();
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const quietSchema = z.object({ enabled: z.boolean(), start: time, end: time });

export async function setQuietHoursAction(raw: unknown): Promise<ActionState<never>> {
  const parsed = quietSchema.safeParse(raw);
  if (!parsed.success) return fail("Horário inválido.");
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("notification_settings").upsert(
    { user_id: user.id, quiet_enabled: parsed.data.enabled, quiet_start: parsed.data.start, quiet_end: parsed.data.end },
    { onConflict: "user_id" },
  );
  if (error) return fail("Não foi possível salvar.");
  return ok("Horário de silêncio salvo.");
}

export async function markNotificationReadAction(id: string): Promise<ActionState<never>> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return fail("Inválido.");
  await requireUser();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", parsed.data).is("read_at", null);
  revalidatePath("/", "layout");
  return ok();
}

export async function markAllNotificationsReadAction(): Promise<ActionState<never>> {
  await requireUser();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  revalidatePath("/", "layout");
  return ok("Tudo marcado como lido.");
}
