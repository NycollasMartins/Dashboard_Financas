import { expect, test, type Page } from "@playwright/test";

/*
 * Fluxos da Fase 2 com os dados do seed (família "Casa Teste" da Ana).
 * Valores "estranhos" (ex.: R$ 123,47) tornam cada lançamento fácil de achar.
 */

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

/** Regex do valor como aparece no nome acessível (o espaço não separável vira \s). */
const amountRe = (cents: number) => new RegExp(brl(cents).replace(/[.$]/g, "\\$&").replace(/\u00a0/g, "\\s"));

/** Valor único por execução e por projeto (evita colisão entre dispositivos). */
function uniqueCents(base: number, info: { project: { name: string } }) {
  const p = info.project.name.length;
  return base + (Date.now() % 9000) + p;
}

async function openQuickAdd(page: Page) {
  await page.getByRole("button", { name: "Novo lançamento" }).filter({ visible: true }).first().click();
  const sheet = page.getByRole("dialog", { name: "Novo lançamento" });
  await expect(sheet).toBeVisible();
  return sheet;
}

test("lançamento rápido em 3 toques: + → valor → categoria → Salvar", async ({ page }, info) => {
  const cents = uniqueCents(10_000, info);
  await page.goto("/lancamentos");

  let taps = 0;
  const sheet = await openQuickAdd(page); // toque 1
  taps++;
  const amount = sheet.getByLabel("Valor");
  await expect(amount).toHaveAttribute("inputmode", "decimal"); // teclado numérico no iPhone
  await expect(amount).toBeFocused();
  await amount.pressSequentially(String(cents)); // digitar não conta como toque
  await expect(amount).toHaveValue(brl(cents));
  await sheet.getByRole("radio", { name: "Mercado" }).click(); // toque 2
  taps++;
  await sheet.getByRole("button", { name: "Salvar", exact: true }).click(); // toque 3
  taps++;

  expect(taps).toBeLessThanOrEqual(3);
  await expect(page.getByText(/(Despesa|Compra no cartão) registrada\./)).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(`Mercado.*${amountRe(cents).source}`) }).first()).toBeVisible();
});

test("compra parcelada no cartão mostra a fatura e cria as parcelas", async ({ page }, info) => {
  test.skip(/SE|Android/.test(info.project.name), "fluxo pesado: desktop e iPhone 15");
  const desc = `TV ${Date.now()}`;
  await page.goto("/lancamentos");
  const sheet = await openQuickAdd(page);
  await sheet.getByLabel("Valor").pressSequentially("300000");
  await sheet.getByRole("radio", { name: "Compras" }).click();
  await sheet.getByRole("radio", { name: "Crédito" }).click();
  await sheet.getByLabel("Cartão").selectOption({ label: "Nubank" });
  await sheet.getByLabel("Parcelas").selectOption("3");
  await expect(sheet.getByText(/3x de R\$\s1\.000,00 — da fatura de/)).toBeVisible();
  await sheet.getByRole("button", { name: "Mais opções" }).click();
  await sheet.getByLabel("Descrição").fill(desc);
  await sheet.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Compra em 3x registrada.")).toBeVisible();
  await page.getByPlaceholder("Buscar descrição…").fill(desc);
  await expect(page.getByText(/Compras · Nubank · 1\/3/).first()).toBeVisible();
});

test("excluir lançamento e desfazer", async ({ page }, info) => {
  test.skip(/SE|Android/.test(info.project.name), "desktop e iPhone 15");
  const cents = uniqueCents(20_000, info);
  await page.goto("/lancamentos");
  const sheet = await openQuickAdd(page);
  await sheet.getByLabel("Valor").pressSequentially(String(cents));
  await sheet.getByRole("radio", { name: "Mercado" }).click();
  await sheet.getByRole("button", { name: "Salvar", exact: true }).click();
  const row = page.getByRole("button", { name: amountRe(cents) }).first();
  await row.click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir lançamento" }).click();
  await expect(page.getByText("Lançamento excluído.")).toBeVisible();
  await expect(row).toBeHidden();
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByText("Exclusão desfeita.")).toBeVisible();
  await expect(row).toBeVisible();
});

test("pagar fatura muda o status e não cria despesa", async ({ page }, info) => {
  test.skip(info.project.name !== "Desktop Chrome", "altera dados compartilhados: só desktop");
  await page.goto("/cartoes");
  await page.getByRole("link", { name: /Fatura de/ }).first().click();
  await expect(page).toHaveURL(/\/cartoes\/[0-9a-f-]+/);
  const pay = page.getByRole("button", { name: "Registrar pagamento" });
  if (await pay.isDisabled()) test.skip(true, "fatura já paga");
  await pay.click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar pagamento" }).click();
  await expect(page.getByText("Pagamento registrado.")).toBeVisible();
  await expect(page.getByText("Paga", { exact: true })).toBeVisible();
});

test("criar recorrência gera o previsto do mês", async ({ page }, info) => {
  test.skip(info.project.name !== "Desktop Chrome", "só desktop");
  const desc = `Seguro ${Date.now()}`;
  await page.goto("/recorrencias");
  await page.getByRole("button", { name: "Nova recorrência" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Descrição").fill(desc);
  await sheet.getByLabel("Valor").pressSequentially("9990");
  await sheet.getByLabel("Dia").fill("28");
  await sheet.getByRole("button", { name: "Criar recorrência" }).click();
  await expect(page.getByText(/Recorrência criada/)).toBeVisible();
  await page.goto(`/lancamentos?q=${encodeURIComponent(desc)}`);
  await expect(page.getByText(desc).first()).toBeVisible();
});

test("categoria em uso só é excluída movendo os lançamentos", async ({ page }, info) => {
  test.skip(info.project.name !== "Desktop Chrome", "só desktop");
  const name = `Temp ${Date.now()}`;
  await page.goto("/categorias");
  await page.getByRole("button", { name: "Nova" }).first().click();
  let sheet = page.getByRole("dialog");
  await sheet.getByLabel("Nome").fill(name);
  await sheet.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Categoria criada.")).toBeVisible();

  // Usa a categoria num lançamento
  await page.goto("/lancamentos");
  sheet = await openQuickAdd(page);
  await sheet.getByLabel("Valor").pressSequentially("1111");
  await sheet.getByRole("button", { name: "Ver todas as categorias" }).click();
  await sheet.getByRole("radio", { name }).click();
  await sheet.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText(/(Despesa|Compra no cartão) registrada\./)).toBeVisible();

  // Exclui movendo para "Outros"
  await page.goto("/categorias");
  await page.getByRole("button", { name: `Editar ${name}` }).click();
  sheet = page.getByRole("dialog");
  await sheet.getByLabel("Mover lançamentos para").selectOption({ label: "Outros" });
  await sheet.getByRole("button", { name: "Excluir e mover lançamentos" }).click();
  await expect(page.getByText("Categoria excluída.")).toBeVisible();
  await expect(page.getByText(name)).toHaveCount(0);
});
