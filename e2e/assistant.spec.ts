import { expect, test, type Page } from "@playwright/test";

/*
 * Fase 5 — assistente (sem IA no ambiente de teste: parser local).
 * Cada teste desfaz o que gravou para não afetar os outros.
 */

const heavy = (name: string) => /SE|Android/.test(name);

async function say(page: Page, text: string) {
  const input = page.getByLabel("Mensagem para o assistente");
  const bubbles = page.getByRole("region", { name: "Conversa" }).locator("[data-role=assistant]");
  const before = await bubbles.count();
  await input.fill(text);
  await input.press("Enter");
  // Espera a resposta chegar (mais bolhas na conversa) e o "Pensando…" sumir.
  await expect.poll(() => bubbles.count(), { timeout: 20_000 }).toBeGreaterThan(before);
  await expect(page.getByText("Pensando…")).toBeHidden({ timeout: 20_000 });
}
const conversation = (page: Page) => page.getByRole("region", { name: "Conversa" });

test.beforeEach(async ({ page }) => {
  await page.goto("/assistente");
  await expect(page.getByLabel("Mensagem para o assistente")).toBeVisible();
});

test("registra em linguagem natural e desfaz pelo botão", async ({ page }, info) => {
  const v = 11 + (Date.now() % 80) + info.project.name.length;
  await say(page, `gastei ${v} no uber`);
  const conv = conversation(page);
  await expect(conv.getByText("Gravado.").last()).toBeVisible();
  await expect(conv.getByText(new RegExp(`R\\$\\s${v},00 · Uber \\(Transporte`)).last()).toBeVisible();
  await conv.getByRole("button", { name: "Desfazer" }).last().click();
  await expect(conv.getByText("Desfeito: o último registro foi apagado.").last()).toBeVisible();
});

test("vários lançamentos pedem confirmação; editar categoria e confirmar", async ({ page }, info) => {
  test.skip(heavy(info.project.name), "desktop e iPhone 15");
  await say(page, "gastei 12 no uber e 34 na lojinha");
  const card = conversation(page).getByRole("group", { name: "Confirmar lançamentos" }).last();
  await expect(card.getByText(/R\$\s12,00/)).toBeVisible();
  await expect(card.getByText(/R\$\s34,00/)).toBeVisible();
  await card.getByRole("button", { name: "Editar" }).click();
  await card.getByLabel("Categoria").nth(1).selectOption({ label: "Compras" });
  await card.getByRole("button", { name: "Confirmar tudo" }).click();
  await expect(conversation(page).getByText("2 lançamentos gravados.").last()).toBeVisible();
  await expect(conversation(page).getByText(/R\$\s34,00 · Lojinha \(Compras/).last()).toBeVisible();
  await say(page, "desfazer");
  await expect(conversation(page).getByText("Desfeito: 2 registros apagados.").last()).toBeVisible();
});

test("pergunta quando há ambiguidade e mostra opções", async ({ page }, info) => {
  test.skip(heavy(info.project.name), "desktop e iPhone 15");
  await say(page, "gastei 21 no credito");
  await expect(conversation(page).getByText("Em qual cartão?").last()).toBeVisible();
  await conversation(page).getByRole("button", { name: /Inter/ }).last().click();
  // Sem categoria → confirma antes de gravar (regra de baixa confiança)
  const card = conversation(page).getByRole("group", { name: "Confirmar lançamentos" }).last();
  await expect(card.getByText(/Cartão Inter/)).toBeVisible();
  await card.getByRole("button", { name: "Confirmar" }).click();
  await expect(conversation(page).getByText(/R\$\s21,00 · .*Cartão Inter/).last()).toBeVisible();
  await say(page, "desfazer");
  await expect(conversation(page).getByText(/Desfeito/).last()).toBeVisible();
});

test("consulta é respondida com dados do banco", async ({ page }) => {
  await say(page, "quanto gastei com mercado?");
  await expect(conversation(page).getByText(/Você gastou R\$\s[\d.,]+ com Mercado em/).last()).toBeVisible();
  await say(page, "como ta a meta do carro");
  await expect(conversation(page).getByText(/Carro: R\$\s[\d.,]+ de R\$\s60\.000,00/).last()).toBeVisible();
});

test("aviso de privacidade e apagar histórico", async ({ page }, info) => {
  test.skip(heavy(info.project.name), "desktop e iPhone 15");
  await page.getByText(/IA não configurada|Entendo a maioria das mensagens aqui mesmo/).click();
  await expect(page.getByText(/Nunca envio saldos, valores do seu histórico/)).toBeVisible();
  await say(page, "ajuda");
  await expect(conversation(page).getByText(/Eu registro e consulto suas finanças por mensagem/).last()).toBeVisible();
  await page.getByRole("button", { name: "Apagar histórico da conversa" }).click();
  await expect(page.getByText("Histórico apagado.")).toBeVisible();
  await expect(conversation(page).getByText(/Eu registro e consulto/)).toHaveCount(0);
});

test("atalho no botão + leva ao assistente", async ({ page }, info) => {
  test.skip(heavy(info.project.name), "desktop e iPhone 15");
  await page.goto("/lancamentos");
  await page.getByRole("button", { name: "Novo lançamento" }).filter({ visible: true }).first().click();
  await page.getByRole("link", { name: /Falar com o assistente/ }).click();
  await expect(page).toHaveURL(/\/assistente/);
});
