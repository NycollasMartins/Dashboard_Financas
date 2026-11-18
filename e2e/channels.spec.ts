import { expect, test } from "@playwright/test";
import { localAdmin, userId } from "./admin";
import { USERS } from "./fixtures";

/* Fase 6 — Configurações → Canais (vincular o Telegram). */

test.afterEach(async () => {
  await localAdmin().from("channel_links").delete().eq("user_id", await userId(USERS.ana.email));
});

test("gera código de uso único com QR e link direto para o bot", async ({ page }) => {
  await page.goto("/configuracoes/canais");
  await expect(page.getByRole("heading", { name: "Canais" })).toBeVisible();
  const gen = page.getByRole("button", { name: "Gerar código" });
  // Sem token do bot no ambiente de teste o botão fica desligado e o aviso aparece.
  if (await gen.isDisabled()) {
    await expect(page.getByText(/bot ainda não está configurado/)).toBeVisible();
    return;
  }
  await gen.click();
  const code = (await page.getByTestId("link-code").textContent())!;
  expect(code).toMatch(/^[2-9A-HJ-NP-Z]{8}$/);
  await expect(page.getByRole("img", { name: "QR code para vincular o Telegram" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir no Telegram" })).toHaveAttribute("href", `https://t.me/LarMaisBot?start=${code}`);
  await expect(page.getByText(/Expira em [0-9]:[0-5]\d/)).toBeVisible();
});

test("vinculado: escolhe o espaço e desvincula", async ({ page }) => {
  const uid = await userId(USERS.ana.email);
  const admin = localAdmin();
  const { data: ws } = await admin.from("workspaces").select("id").eq("owner_id", uid).eq("kind", "personal").single();
  await admin.from("channel_links").insert({ user_id: uid, channel: "telegram", external_id: "77001234", display_label: "Ana", default_workspace_id: ws!.id });

  await page.goto("/configuracoes/canais");
  await expect(page.getByText(/Vinculado a Ana/)).toBeVisible();
  await expect(page.getByLabel("Onde gravar o que chega pelo Telegram")).toBeVisible();
  await page.getByRole("button", { name: "Desvincular" }).click();
  await expect(page.getByText("Telegram desvinculado.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Gerar código/ })).toBeVisible();
});
