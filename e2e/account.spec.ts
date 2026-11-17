import { expect, test } from "@playwright/test";
import { messagesTo, waitForLink } from "./mailpit";

test.describe("ciclo de vida da conta", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "Desktop Chrome", "roda só no desktop"));

  test("cadastro → confirmação → troca de e-mail (2 confirmações) → exclusão", async ({ page }) => {
    const id = Date.now();
    const email = `e2e-${id}@teste.local`;
    const newEmail = `e2e-${id}-novo@teste.local`;
    const password = "Teste12345";

    // Cadastro
    await page.goto("/cadastro");
    await page.getByLabel("Seu nome").fill("Pessoa E2E");
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText(/Enviamos um link de confirmação/)).toBeVisible();

    // Confirmação pelo link do e-mail
    await page.goto(await waitForLink(email, /Confirme seu e-mail/));
    await expect(page).toHaveURL(/\/painel/);

    // Troca de e-mail: confirmação vai para os DOIS endereços
    await page.goto("/configuracoes");
    await page.getByLabel("Novo e-mail").fill(newEmail);
    await page.getByLabel("Senha atual").first().fill(password);
    await page.getByRole("button", { name: "Trocar e-mail" }).click();
    await expect(page.getByText(/O e-mail só muda depois que você confirmar nos dois/)).toBeVisible();
    await expect.poll(async () => (await messagesTo(email)).some((m) => /troca de e-mail|novo e-mail/i.test(m.Subject))).toBe(true);
    await expect.poll(async () => (await messagesTo(newEmail)).length).toBeGreaterThan(0);
    await page.goto(await waitForLink(email, /troca de e-mail|novo e-mail/i));
    await page.goto(await waitForLink(newEmail, /troca de e-mail|novo e-mail/i));
    await page.goto("/configuracoes");
    await expect(page.getByText(`E-mail atual: ${newEmail}`)).toBeVisible();

    // Exclusão da conta
    await page.getByRole("button", { name: "Excluir minha conta" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Senha atual").fill(password);
    await dialog.getByLabel('Digite "EXCLUIR"').fill("EXCLUIR");
    await dialog.getByRole("button", { name: "Excluir definitivamente" }).click();
    await expect(page).toHaveURL(/\/entrar\?conta=excluida/);
    await expect(page.getByText("Sua conta foi excluída.")).toBeVisible();

    // Não consegue mais entrar
    await page.getByLabel("E-mail", { exact: true }).fill(newEmail);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos" })).toBeVisible();
  });
});
