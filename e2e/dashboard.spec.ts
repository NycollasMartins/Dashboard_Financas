import { expect, test, type Page } from "@playwright/test";

/*
 * Fase 3 — painel: filtros na URL (link compartilhável + botão voltar),
 * competência × caixa, clique na categoria → lista filtrada, ocultar valores,
 * tabela alternativa dos gráficos e estados vazios. Usa o seed (12 meses).
 */

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const thisMonth = today.slice(0, 7);
function prevMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
const monthTitle = (ym: string) => {
  const s = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${ym}-01T12:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const periodButton = (page: Page) => page.getByRole("button", { name: /^Período:/ });

test("KPIs, saldo projetado e blocos principais aparecem com os dados do seed", async ({ page }) => {
  await page.goto("/painel");
  const resumo = page.getByRole("region", { name: "Resumo do período" });
  for (const k of ["Receitas", "Despesas", "Saldo do período", "Taxa de economia"]) {
    await expect(resumo.getByRole("heading", { name: k, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: /Saldo projetado/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Gastos por categoria" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evolução em 12 meses" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Próximos vencimentos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Uso do limite dos cartões" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Gastos por membro" })).toBeVisible();
  // Variação com texto (não só cor)
  await expect(resumo.getByText(/em relação a/).first()).toBeAttached();
});

test("navegar de mês muda a URL e o botão voltar desfaz", async ({ page }) => {
  await page.goto("/painel");
  await expect(periodButton(page)).toContainText(monthTitle(thisMonth));
  await page.getByRole("button", { name: "Mês anterior" }).click();
  await expect(page).toHaveURL(new RegExp(`periodo=${prevMonth(thisMonth)}`));
  await expect(periodButton(page)).toContainText(monthTitle(prevMonth(thisMonth)));
  await page.goBack();
  await expect(page).not.toHaveURL(/periodo=/);
  await expect(periodButton(page)).toContainText(monthTitle(thisMonth));
});

test("alternar competência × caixa fica na URL e o link é compartilhável", async ({ page }) => {
  await page.goto("/painel");
  await page.getByRole("radio", { name: "Caixa" }).click();
  await expect(page).toHaveURL(/visao=caixa/);
  await expect(page.getByRole("radio", { name: "Caixa" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText(/Visão caixa\./)).toBeVisible();
  // Abrir o mesmo link "do zero" mantém a visão
  await page.goto(`/painel?visao=caixa&periodo=${prevMonth(thisMonth)}`);
  await expect(page.getByRole("radio", { name: "Caixa" })).toHaveAttribute("aria-checked", "true");
  await expect(periodButton(page)).toContainText(monthTitle(prevMonth(thisMonth)));
});

test("ano e intervalo personalizado pela URL e pelo seletor", async ({ page }) => {
  await page.goto(`/painel?ano=${today.slice(0, 4)}`);
  await expect(periodButton(page)).toContainText(today.slice(0, 4));
  await periodButton(page).click();
  const sheet = page.getByRole("dialog", { name: "Período" });
  await sheet.getByRole("tab", { name: "Intervalo" }).click();
  await sheet.getByLabel("De", { exact: true }).fill(`${prevMonth(thisMonth)}-01`);
  await sheet.getByLabel("Até", { exact: true }).fill(`${thisMonth}-10`);
  await sheet.getByRole("button", { name: "Aplicar" }).click();
  await expect(page).toHaveURL(new RegExp(`de=${prevMonth(thisMonth)}-01&ate=${thisMonth}-10`));
  await expect(page).not.toHaveURL(/ano=/);
  await expect(periodButton(page)).toContainText(`01/${prevMonth(thisMonth).slice(5)}/`);
});

test("filtro de categoria vira chip e pode ser removido", async ({ page }) => {
  await page.goto("/painel");
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Filtros" });
  await sheet.getByLabel("Categoria").selectOption({ label: "Mercado" });
  await expect(page).toHaveURL(/categoria=/);
  await sheet.getByRole("button", { name: "Ver resultado" }).click();
  const chip = page.getByRole("button", { name: "Remover filtro Mercado" });
  await expect(chip).toBeVisible();
  // Só Mercado no gráfico de categorias
  const cats = page.getByRole("region", { name: "Gastos por categoria" });
  await expect(cats.getByRole("link", { name: "Mercado: ver lançamentos" })).toBeVisible();
  await expect(cats.getByRole("link", { name: "Moradia: ver lançamentos" })).toHaveCount(0);
  await chip.click();
  await expect(page).not.toHaveURL(/categoria=/);
});

test("clicar numa categoria abre os lançamentos filtrados", async ({ page }) => {
  await page.goto("/painel");
  await page.getByRole("region", { name: "Gastos por categoria" }).getByRole("link", { name: "Moradia: ver lançamentos" }).click();
  await expect(page).toHaveURL(/\/lancamentos\?.*categoria=.*tipo=expense/);
  await expect(page.getByRole("button", { name: /Aluguel/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Mercado/ })).toHaveCount(0);
});

test("gráfico de evolução tem tabela alternativa com 12 meses", async ({ page }) => {
  await page.goto("/painel");
  await page.getByRole("button", { name: "Ver Evolução em 12 meses como tabela" }).click();
  const table = page.getByRole("table", { name: /Evolução mensal/ });
  await expect(table).toBeVisible();
  await expect(table.getByRole("row")).toHaveCount(13); // cabeçalho + 12 meses
});

/** Clica no olho e espera a Server Action gravar a preferência (POST na própria página). */
async function togglePrivacy(page: Page, name: "Ocultar valores" | "Mostrar valores") {
  const saved = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/painel"));
  await page.getByRole("button", { name }).filter({ visible: true }).first().click();
  await saved;
}

test("ocultar valores esconde os R$ e a preferência fica salva no perfil", async ({ page }) => {
  // Regressão: tocar no olho antes de um bloco em streaming hidratar gerava "hydration mismatch".
  const hydrationErrors: string[] = [];
  page.on("console", (m) => m.type() === "error" && /Hydration failed/.test(m.text()) && hydrationErrors.push(m.text()));
  await page.goto("/painel");
  const resumo = page.getByRole("region", { name: "Resumo do período" });
  const shown = resumo.getByText(/R\$\s\d/).filter({ visible: true });
  await expect(shown.first()).toBeVisible();
  try {
    await togglePrivacy(page, "Ocultar valores");
    // O CSS troca o valor por "R$ ••••" (::after) e tira o número da tela e do leitor de tela
    await expect(page.locator('[data-privacy="on"]')).toHaveCount(1);
    await expect(shown).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: "Mostrar valores" }).filter({ visible: true }).first()).toBeVisible();
    await expect(shown).toHaveCount(0);
  } finally {
    // Sempre volta ao normal: os outros testes leem os valores.
    await page.goto("/painel");
    // Espera o botão do olho existir (em qualquer estado) antes de decidir.
    const eye = page.getByRole("button", { name: /^(Mostrar|Ocultar) valores$/ }).filter({ visible: true }).first();
    await expect(eye).toBeVisible();
    if ((await eye.getAttribute("aria-pressed")) === "true") {
      await togglePrivacy(page, "Mostrar valores");
    }
  }
  await expect(shown.first()).toBeVisible();
  expect(hydrationErrors, "sem erros de hidratação").toEqual([]);
});

test("mês sem lançamentos mostra estado vazio amigável", async ({ page }) => {
  await page.goto("/painel?periodo=2020-01");
  await expect(page.getByText("Nenhum lançamento em janeiro de 2020.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Lançar agora" })).toBeVisible();
  await expect(page.getByText("Nenhuma despesa neste período.").first()).toBeVisible();
});

test("regressão: 1ª compra parcelada num cartão novo (sem fatura) é salva", async ({ page }, info) => {
  test.skip(/SE|Android/.test(info.project.name), "desktop e iPhone 15");
  const name = `Teste ${Date.now() % 100000}`;
  await page.goto("/cartoes");
  await page.getByRole("button", { name: "Novo cartão" }).filter({ visible: true }).first().click();
  const form = page.getByRole("dialog", { name: "Novo cartão" });
  await form.getByLabel("Nome").fill(name);
  await form.getByRole("button", { name: "Cadastrar cartão" }).click();
  await expect(form).toBeHidden();

  await page.goto("/lancamentos");
  await page.getByRole("button", { name: "Novo lançamento" }).filter({ visible: true }).first().click();
  const sheet = page.getByRole("dialog", { name: "Novo lançamento" });
  await sheet.getByLabel("Valor").pressSequentially("60000");
  await sheet.getByRole("radio", { name: "Compras" }).click();
  await sheet.getByRole("radio", { name: "Crédito" }).click();
  await sheet.getByLabel("Cartão").selectOption({ label: name });
  await sheet.getByLabel("Parcelas").selectOption("2");
  await sheet.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Compra em 2x registrada.")).toBeVisible();
});
