import { expect, test } from "@playwright/test";
import { localAdmin, userId } from "./admin";
import { isMobile, USERS } from "./fixtures";

/* Fase 6 — central de notificações, preferências e guia do iPhone. */

const KEY = `e2e:${Date.now()}`;

test.afterEach(async () => {
  await localAdmin().from("notifications").delete().like("event_key", "e2e:%");
  await localAdmin().from("notification_prefs").delete().eq("user_id", await userId(USERS.ana.email));
});

test("sino mostra não lidas; tocar abre a tela certa e marca como lida", async ({ page }, info) => {
  const uid = await userId(USERS.ana.email);
  await localAdmin().from("notifications").insert({
    user_id: uid, kind: "invoice_due", event_key: `${KEY}:${info.project.name}`,
    title: "Fatura do Nubank vence amanhã", body: "A pagar: R$ 1.234,56", url: "/cartoes",
  });
  await page.goto("/painel");
  const bell = page.getByRole("link", { name: /Notificações: 1 não lida/ }).filter({ visible: true });
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(page).toHaveURL(/\/notificacoes/);
  const item = page.getByRole("button", { name: /Fatura do Nubank vence amanhã/ });
  await expect(item).toHaveAttribute("data-unread", "true");
  await item.click();
  await expect(page).toHaveURL(/\/cartoes/);
  await expect(page.getByRole("link", { name: "Notificações", exact: true }).filter({ visible: true }).first()).toBeVisible();
});

test("preferências por tipo e canal ficam salvas; horário de silêncio", async ({ page }) => {
  await page.goto("/configuracoes/notificacoes");
  const weekly = page.getByRole("switch", { name: "Resumo semanal: ligado" });
  await expect(weekly).toHaveAttribute("aria-checked", "true");
  await weekly.click();
  await expect(weekly).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("switch", { name: "Resumo semanal: push" })).toBeDisabled();
  // "Lançamento de outro membro" vem desligado (opcional)
  await expect(page.getByRole("switch", { name: "Lançamento de outro membro: ligado" })).toHaveAttribute("aria-checked", "false");
  await expect.poll(async () => {
    const { data } = await localAdmin().from("notification_prefs").select("enabled").eq("kind", "weekly_summary").eq("user_id", await userId(USERS.ana.email)).maybeSingle();
    return data?.enabled;
  }).toBe(false);
  await page.reload();
  await expect(page.getByRole("switch", { name: "Resumo semanal: ligado" })).toHaveAttribute("aria-checked", "false");
  await page.getByLabel("De").fill("23:00");
  await page.getByRole("button", { name: "Salvar horário" }).click();
  await expect(page.getByText("Horário de silêncio salvo.")).toBeVisible();
});

test("iPhone fora da Tela de Início: mostra o guia antes de pedir permissão", async ({ page }, info) => {
  test.skip(!/iPhone/.test(info.project.name), "só iPhone");
  await page.goto("/configuracoes/notificacoes");
  const guide = page.getByTestId("ios-install-guide");
  if (await page.getByText(/Push ainda não configurado/).isVisible()) return; // sem VAPID no ambiente
  await expect(guide).toBeVisible();
  await expect(guide).toContainText("Adicionar à Tela de Início");
  await expect(page.getByRole("button", { name: "Ativar notificações" })).toHaveCount(0);
  void isMobile;
});
