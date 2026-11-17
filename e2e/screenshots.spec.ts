import { devices, test } from "@playwright/test";

/**
 * Gera as imagens do README em docs/images (pnpm screenshots).
 * Usa o seed de demonstração; rode após `pnpm db:reset`.
 */
const PAGES = [
  ["painel", "/painel"],
  ["lancamentos", "/lancamentos"],
  ["cartoes", "/cartoes"],
  ["contas", "/contas"],
  ["recorrencias", "/recorrencias"],
  ["familia", "/familia"],
] as const;

// Sem defaultBrowserType: o projeto "screenshots" roda no Chromium; a emulação
// de tela/toque do iPhone basta para as imagens do README.
const strip = <T extends { defaultBrowserType?: unknown }>({ defaultBrowserType, ...rest }: T) => (void defaultBrowserType, rest);
const TARGETS = [
  { name: "desktop", use: { ...strip(devices["Desktop Chrome"]), viewport: { width: 1440, height: 900 } } },
  { name: "iphone", use: strip(devices["iPhone 15"]) },
] as const;

for (const t of TARGETS) {
  test.describe(t.name, () => {
    test.use({ ...t.use, storageState: "e2e/.auth/ana.json", colorScheme: "dark" });

    for (const [slug, path] of PAGES) {
      test(`${slug}`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(600); // animações de entrada
        await page.screenshot({ path: `docs/images/${t.name}-${slug}.png` });
      });
    }

    test("lancamento-rapido", async ({ page }) => {
      await page.goto("/lancamentos");
      await page.getByRole("button", { name: "Novo lançamento" }).filter({ visible: true }).first().click();
      await page.getByLabel("Valor").pressSequentially("4590");
      await page.getByRole("radio", { name: "Restaurantes e delivery" }).click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `docs/images/${t.name}-lancamento-rapido.png` });
    });

    test("fatura", async ({ page }) => {
      await page.goto("/cartoes");
      await page.getByRole("link", { name: /Fatura de/ }).first().click();
      await page.waitForURL(/\/cartoes\/[0-9a-f-]+/);
      await page.getByText("Itens", { exact: true }).waitFor();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `docs/images/${t.name}-fatura.png` });
    });
  });
}
