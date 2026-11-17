import { expect, test as setup } from "@playwright/test";
import { USERS } from "./fixtures";

/** Faz login uma vez e salva os cookies para os demais testes. */
setup("login da Ana (seed)", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(USERS.ana.email);
  await page.getByLabel("Senha", { exact: true }).fill(USERS.ana.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/painel/);
  await page.context().storageState({ path: "e2e/.auth/ana.json" });
});
