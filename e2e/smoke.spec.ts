import { expect, test } from "@playwright/test";

/*
 * SMOKE TEST DE PRODUÇÃO — você roda depois de cada deploy:
 *   E2E_BASE_URL=https://larmais.tech SMOKE_EMAIL=... SMOKE_PASSWORD=... pnpm test:smoke
 * Use um USUÁRIO DE TESTE DEDICADO (sem dados reais, sem família). O único
 * lançamento criado é desfeito no próprio teste.
 */
const email = process.env.SMOKE_EMAIL ?? "";
const password = process.env.SMOKE_PASSWORD ?? "";

test.describe.configure({ mode: "serial" });

test("saúde, headers de segurança e manifest", async ({ request, baseURL }) => {
  const health = await request.get("/api/health?deep=1");
  expect(health.ok()).toBe(true);
  expect(await health.json()).toMatchObject({ status: "ok", app: "larmais", supabase: "ok" });
  const page = await request.get("/entrar");
  const h = page.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-powered-by"]).toBeUndefined();
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.name).toBe("Lar+");
  expect(baseURL).toMatch(/^https:\/\//);
});

test("rotas de servidor recusam chamadas sem segredo", async ({ request }) => {
  const tg = await request.post("/api/telegram/webhook", { data: { update_id: 1 } });
  expect([401, 503]).toContain(tg.status());
  const tgWrong = await request.post("/api/telegram/webhook", { data: { update_id: 1 }, headers: { "x-telegram-bot-api-secret-token": "errado" } });
  expect([401, 503]).toContain(tgWrong.status());
  const cron = await request.post("/api/notifications/dispatch", { headers: { "x-cron-secret": "errado" } });
  expect([401, 503]).toContain(cron.status());
});

test("login, painel e assistente (grava e desfaz)", async ({ page }) => {
  test.skip(!email || !password, "defina SMOKE_EMAIL e SMOKE_PASSWORD (usuário de teste dedicado)");
  await page.goto("/entrar");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/painel/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.goto("/assistente");
  const input = page.getByLabel("Mensagem para o assistente");
  await input.fill("gastei 1 no teste smoke");
  await input.press("Enter");
  const conv = page.getByRole("region", { name: "Conversa" });
  await expect(conv.getByText(/Gravado|Confira|confirme/).last()).toBeVisible({ timeout: 30_000 });
  const confirm = conv.getByRole("button", { name: /^Confirmar/ }).last();
  if (await confirm.isVisible()) await confirm.click();
  await conv.getByRole("button", { name: "Desfazer" }).last().click();
  await expect(conv.getByText(/Desfeito/).last()).toBeVisible({ timeout: 20_000 });
});
