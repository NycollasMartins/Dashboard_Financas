import { devices, expect, test } from "@playwright/test";

/**
 * Gera as imagens do README em docs/images (pnpm screenshots).
 * Usa o seed de demonstração; rode após `pnpm db:reset`.
 */
const PAGES = [
  ["painel", "/painel"],
  ["painel-caixa", `/painel?visao=caixa&ano=${new Date().getFullYear()}`],
  ["metas", "/metas"],
  ["planejamento", "/planejamento"],
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
        await page.waitForTimeout(1200); // animações de entrada (barras dos gráficos)
        // Painel no desktop: página inteira (mostra todos os gráficos).
        const fullPage = t.name === "desktop" && (slug.startsWith("painel") || slug === "planejamento");
        await page.screenshot({ path: `docs/images/${t.name}-${slug}.png`, fullPage });
      });
    }

    test("lancamento-rapido", async ({ page }) => {
      await page.goto("/lancamentos");
      await page.getByRole("button", { name: "Novo lançamento" }).filter({ visible: true }).first().click();
      await page.getByLabel("Valor", { exact: true }).pressSequentially("4590");
      await page.getByRole("radio", { name: "Restaurantes e delivery" }).click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `docs/images/${t.name}-lancamento-rapido.png` });
    });

    test("meta", async ({ page }) => {
      await page.goto("/metas");
      await page.getByRole("link", { name: "Carro" }).click();
      await page.waitForURL(/\/metas\/[0-9a-f-]+/);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(800);
      await page.screenshot({ path: `docs/images/${t.name}-meta.png`, fullPage: t.name === "desktop" });
    });

    test("guardar-meta", async ({ page }) => {
      await page.goto("/metas");
      await page.getByRole("button", { name: "Guardar para Carro" }).click();
      await page.getByLabel("Valor", { exact: true }).pressSequentially("30000");
      await page.waitForTimeout(500);
      await page.screenshot({ path: `docs/images/${t.name}-guardar-meta.png` });
    });

    test("assistente", async ({ page }) => {
      await page.goto("/assistente");
      const input = page.getByLabel("Mensagem para o assistente");
      await expect(input).toBeVisible();
      const conv = page.getByRole("region", { name: "Conversa" });
      for (const [msg, wait] of [
        ["gastei 45,90 no ifood ontem", /Gravado/],
        ["gastei 30 no uber e 80 no mercado", /Confira os itens/],
      ] as const) {
        await input.fill(msg);
        await input.press("Enter");
        await expect(conv.getByText(wait).last()).toBeVisible({ timeout: 20_000 });
      }
      await page.waitForTimeout(500);
      await page.screenshot({ path: `docs/images/${t.name}-assistente.png` });
      await conv.getByRole("button", { name: "Cancelar" }).last().click();
      await input.fill("desfazer");
      await input.press("Enter");
      await expect(conv.getByText(/Desfeito/).last()).toBeVisible({ timeout: 20_000 });
      await page.getByText(/IA não configurada|Entendo a maioria/).click();
      await page.getByRole("button", { name: "Apagar histórico da conversa" }).click();
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
