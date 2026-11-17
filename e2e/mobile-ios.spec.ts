import { expect, test, type Page } from "@playwright/test";
import { isMobile } from "./fixtures";

/**
 * Checagens específicas de celular/iOS. Rodam só nos projetos "Mobile".
 */
test.beforeEach(({}, info) => test.skip(!isMobile(info.project.name), "somente celular"));

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "a página não pode rolar na horizontal").toBeLessThanOrEqual(0);
}

for (const path of ["/painel", "/painel?visao=caixa", "/painel?ano=2026", "/metas", "/planejamento", "/lancamentos?visao=caixa", "/assistente", "/familia", "/configuracoes", "/lancamentos", "/cartoes", "/contas", "/recorrencias", "/categorias", "/mais"]) {
  test(`layout sem rolagem horizontal em ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await noHorizontalScroll(page);
  });
}

test("barra inferior fixa, visível e com alvos de toque ≥ 44px", async ({ page }) => {
  await page.goto("/painel");
  const nav = page.locator("nav[aria-label='Principal']").last();
  await expect(nav).toBeVisible();
  const box = await nav.boundingBox();
  const vh = page.viewportSize()!.height;
  expect(Math.round(box!.y + box!.height)).toBe(vh); // encostada na base
  for (const link of await nav.getByRole("link").all()) {
    const b = await link.boundingBox();
    expect(b!.height).toBeGreaterThanOrEqual(44);
    expect(b!.width).toBeGreaterThanOrEqual(44);
  }
  const plus = nav.getByRole("button", { name: /Novo lançamento/ });
  const pb = await plus.boundingBox();
  expect(pb!.height).toBeGreaterThanOrEqual(44);
});

test("barra inferior respeita a safe area (padding-bottom com env())", async ({ page }) => {
  await page.goto("/painel");
  const pb = await page
    .locator("nav[aria-label='Principal']")
    .last()
    .evaluate((el) => getComputedStyle(el).paddingBottom);
  expect(pb).toMatch(/px$/); // env(safe-area-inset-bottom) resolve para px (0 no emulador)
});

test("inputs com fonte ≥ 16px (evita zoom automático do iOS)", async ({ page }) => {
  await page.goto("/configuracoes");
  for (const input of await page.locator("input:visible").all()) {
    const size = await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
  }
});

test("meta tags de PWA/iOS presentes", async ({ page, request }) => {
  await page.goto("/painel");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /apple-touch-icon\.png/);
  await expect(page.locator('meta[name="mobile-web-app-capable"], meta[name="apple-mobile-web-app-capable"]').first()).toHaveAttribute("content", "yes");
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).display).toBe("standalone");
  expect((await request.get("/apple-touch-icon.png")).ok()).toBeTruthy();
});

test("altura usa dvh (não corta atrás da barra do Safari)", async ({ page }) => {
  await page.goto("/painel");
  const minH = await page.locator("main#conteudo").evaluate((el) => el.parentElement!.className);
  expect(minH).toContain("min-h-dvh");
});

test("seletor de espaço abre e lista individual + família", async ({ page }) => {
  await page.goto("/painel");
  await page.getByRole("button", { name: /^Trocar de espaço/ }).filter({ visible: true }).click();
  await expect(page.getByRole("menuitem", { name: /Pessoal/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Casa Teste/ })).toBeVisible();
});

test("folha de lançamento cabe na tela e o botão Salvar fica visível", async ({ page }) => {
  await page.goto("/lancamentos");
  await page.getByRole("button", { name: "Novo lançamento" }).filter({ visible: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Novo lançamento" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  const vp = page.viewportSize()!;
  expect(box!.height).toBeLessThanOrEqual(vp.height);
  await expect(dialog.getByRole("button", { name: "Salvar", exact: true })).toBeInViewport();
  // Alvos de toque das categorias ≥ 44px
  for (const radio of (await dialog.getByRole("radio").all()).slice(0, 6)) {
    const b = await radio.boundingBox();
    expect(b!.height).toBeGreaterThanOrEqual(44);
  }
});
