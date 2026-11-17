import { expect, test, type Page } from "@playwright/test";

/*
 * Fase 4 — metas: criar, guardar em 3 toques (+ global e cartão), retirada com
 * motivo, aporte não vira despesa, conclusão com celebração, simulador,
 * planejamento e a lista de lançamentos na visão caixa (ajuste antes da Fase 4).
 */

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const amountRe = (cents: number) => new RegExp(brl(cents).replace(/[.$]/g, "\\$&").replace(/ /g, "\\s"));
const uniqueCents = (base: number, info: { project: { name: string } }) => base + (Date.now() % 9000) + info.project.name.length;
const heavy = (name: string) => /SE|Android/.test(name);

async function createGoal(page: Page, name: string, targetCents: number) {
  await page.goto("/metas");
  await page.getByRole("button", { name: "Nova meta" }).filter({ visible: true }).first().click();
  const sheet = page.getByRole("dialog", { name: "Nova meta" });
  await sheet.getByLabel("Nome").fill(name);
  await sheet.getByLabel("Quanto você quer juntar").pressSequentially(String(targetCents));
  await sheet.getByRole("button", { name: "Criar meta" }).click();
  await expect(page).toHaveURL(/\/metas\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  // Regressão: tocar no meio do campo de valor e digitar não pode embaralhar os dígitos.
  await expect(page.getByText(amountRe(targetCents)).first()).toBeVisible();
}

test("guardar para meta em 3 toques pelo + global (não vira despesa)", async ({ page }, info) => {
  test.skip(heavy(info.project.name), "desktop e iPhone 15");
  const cents = uniqueCents(10_000, info);
  await page.goto("/painel");
  const despesas = page.getByRole("region", { name: "Resumo do período" }).getByRole("article").filter({ hasText: "Despesas" });
  const before = await despesas.locator("[data-money-value]").first().textContent();

  let taps = 0;
  await page.getByRole("button", { name: "Novo lançamento" }).filter({ visible: true }).first().click(); taps++;
  await page.getByRole("button", { name: "Guardar para meta" }).click(); taps++;
  const sheet = page.getByRole("dialog", { name: "Guardar para meta" });
  // A meta usada por último já vem marcada (nenhum toque extra para escolher).
  const chosen = sheet.getByRole("radiogroup", { name: "Meta" }).getByRole("radio", { checked: true });
  await expect(chosen).toHaveCount(1);
  const goalName = (await chosen.locator("span.truncate").textContent())!.trim();
  await sheet.getByLabel("Valor").pressSequentially(String(cents));
  await sheet.getByRole("button", { name: "Guardar", exact: true }).click(); taps++;
  expect(taps).toBeLessThanOrEqual(3);
  await expect(page.getByText("Aporte registrado.")).toBeVisible();

  // Despesas do mês não mudam; "Guardado em metas" sobe.
  await page.reload();
  await expect(despesas.locator("[data-money-value]").first()).toHaveText(before!);
  await page.goto("/metas");
  await page.getByRole("link", { name: goalName, exact: true }).click();
  await expect(page.getByRole("region", { name: "Histórico" }).getByText(amountRe(cents)).first()).toBeVisible();
});

test("criar meta, guardar pelo cartão, retirada exige motivo e concluir celebra", async ({ page }, info) => {
  test.skip(heavy(info.project.name), "desktop e iPhone 15");
  const name = `Bike ${Date.now() % 100000}`;
  await createGoal(page, name, 50_000);
  await expect(page.getByText("0%").first()).toBeVisible();

  // Guardar pelo botão da meta: 2 toques + valor
  await page.getByRole("button", { name: `Guardar para ${name}` }).click();
  let sheet = page.getByRole("dialog", { name: "Guardar para meta" });
  await expect(sheet.getByRole("radio", { name: new RegExp(name) })).toHaveAttribute("aria-checked", "true");
  await sheet.getByLabel("Valor").pressSequentially("20000");
  await sheet.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Aporte registrado.")).toBeVisible();
  await expect(page.getByText("40%").first()).toBeVisible();

  // Retirada sem motivo é recusada
  await page.getByRole("button", { name: "Retirar" }).click();
  sheet = page.getByRole("dialog", { name: "Retirar da meta" });
  await sheet.getByLabel("Valor").pressSequentially("5000");
  await sheet.getByRole("button", { name: "Registrar retirada" }).click();
  await expect(sheet.getByText("Conte o motivo da retirada.")).toBeVisible();
  await sheet.getByLabel("Motivo da retirada").fill("Pneu furado");
  await sheet.getByRole("button", { name: "Registrar retirada" }).click();
  await expect(page.getByText("Retirada registrada.")).toBeVisible();
  await expect(page.getByText("30%").first()).toBeVisible();

  // Aporte maior que o restante conclui e celebra
  await page.getByRole("button", { name: `Guardar para ${name}` }).click();
  sheet = page.getByRole("dialog", { name: "Guardar para meta" });
  await sheet.getByLabel("Valor").pressSequentially("40000");
  await sheet.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Meta concluída!")).toBeVisible();
  await expect(page.getByText(/Meta atingida com R\$\s50,00 a mais/)).toBeVisible();

  // Arquiva (limpa para os próximos testes)
  await page.getByRole("button", { name: "Arquivar" }).click();
  await expect(page.getByText("Meta arquivada.")).toBeVisible();
});

test("detalhe da meta Carro: números do seed, gráfico com tabela e simulador", async ({ page }) => {
  await page.goto("/metas");
  await page.getByRole("link", { name: "Carro" }).click();
  await expect(page.getByRole("heading", { name: "Carro", level: 1 })).toBeVisible();
  await expect(page.getByText(/R\$\s2\.041,67/).first()).toBeVisible(); // por mês para o prazo
  await expect(page.getByText("Atrasada 4 meses").first()).toBeVisible();
  await page.getByRole("button", { name: "Ver Evolução como tabela" }).click();
  await expect(page.getByRole("table", { name: "Evolução da meta mês a mês" })).toBeVisible();

  const sim = page.getByRole("region", { name: "E se…?" });
  const output = sim.locator("output");
  await expect(output).toContainText("28 meses");
  const monthly = sim.getByLabel("Guardar por mês");
  await monthly.selectText(); // selecionar tudo + digitar substitui o valor
  await monthly.pressSequentially("250000");
  await expect(monthly).toHaveValue(/R\$\s2\.500,00/);
  await expect(output).toContainText("20 meses");
  await expect(output).toContainText("Adiantada 4 meses");
  await expect(sim.getByText(/antecipa a meta em \d+ m[eê]s/)).toBeVisible();
});

test("planejamento mostra sobra, compromissos e sugestão por meta", async ({ page }) => {
  await page.goto("/planejamento");
  await expect(page.getByRole("heading", { name: "Sobra mensal realista" })).toBeVisible();
  await expect(page.getByText("Já comprometido com metas (aportes planejados)")).toBeVisible();
  const table = page.getByRole("table", { name: "Sugestão de quanto guardar por mês em cada meta" });
  await expect(table.getByRole("link", { name: "Carro" })).toBeVisible();
  await expect(table.getByRole("link", { name: "Viagem" })).toBeVisible();
});

test("lista na visão caixa: selo de vencimento e total igual ao do painel", async ({ page }) => {
  const now = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);
  await page.goto(`/painel?visao=caixa&periodo=${now}`);
  const total = (await page.getByRole("region", { name: "Gastos por categoria" }).getByText(/^Total de/).first().textContent())!
    .match(/R\$\s?[\d.,]+\d/)![0];
  await page.getByRole("region", { name: "Gastos por categoria" }).getByRole("link", { name: "Moradia: ver lançamentos" }).click();
  await expect(page).toHaveURL(/visao=caixa/);
  await expect(page.getByRole("note").filter({ hasText: "Visão caixa" })).toBeVisible();
  // Sem filtro de categoria: total de despesas da lista = total do gráfico
  await page.goto(`/lancamentos?visao=caixa&mes=${now}`);
  await expect(page.locator("dt:has-text('Despesas') + dd")).toHaveText(total);
  await expect(page.getByText(/^Vence \d{2}\/\d{2} · compra/).first()).toBeVisible();
});

test("mês futuro: lista mostra as projeções das recorrências", async ({ page }) => {
  const d = new Date();
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 1)).toISOString().slice(0, 7);
  await page.goto(`/lancamentos?mes=${next}`);
  await expect(page.getByText("Projeção", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Aluguel/ }).first()).toBeDisabled();
});

test("campo de valor: tocar no meio e digitar sempre acrescenta no fim", async ({ page }) => {
  await page.goto("/lancamentos");
  await page.getByRole("button", { name: "Novo lançamento" }).filter({ visible: true }).first().click();
  const input = page.getByRole("dialog", { name: "Novo lançamento" }).getByLabel("Valor", { exact: true });
  await input.pressSequentially("12");
  await expect(input).toHaveValue(/R\$\s0,12/);
  // Coloca o cursor no começo (como um toque no meio do campo) e continua digitando
  await input.evaluate((el: HTMLInputElement) => el.setSelectionRange(0, 0));
  await input.pressSequentially("34");
  await expect(input).toHaveValue(/R\$\s12,34/);
  await input.press("Backspace");
  await expect(input).toHaveValue(/R\$\s1,23/);
});
