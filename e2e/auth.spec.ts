import { expect, test } from "@playwright/test";
import { USERS } from "./fixtures";

test.describe("autenticação (sem sessão)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("rota protegida redireciona para o login preservando o destino", async ({ page }) => {
    await page.goto("/familia");
    await expect(page).toHaveURL(/\/entrar\?next=%2Ffamilia/);
  });

  test("senha errada mostra erro e mantém o e-mail", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByLabel("E-mail", { exact: true }).fill(USERS.ana.email);
    await page.getByLabel("Senha", { exact: true }).fill("SenhaErrada1");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos" })).toBeVisible();
    await expect(page.getByLabel("E-mail", { exact: true })).toHaveValue(USERS.ana.email);
  });

  test("validação do cadastro em pt-BR", async ({ page }) => {
    await page.goto("/cadastro");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("Informe seu nome.")).toBeVisible();
    await expect(page.getByText("A senha precisa ter pelo menos 8 caracteres.")).toBeVisible();
  });
});
