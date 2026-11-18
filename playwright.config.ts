import { defineConfig, devices } from "@playwright/test";

/**
 * Testes E2E. Pré-requisito: Supabase local rodando (`pnpm db:start`) com o seed
 * (`pnpm db:reset`). Em CI o workflow sobe tudo sozinho.
 *
 * Projetos móveis usam o WebKit (motor do Safari) com emulação de iPhone. Isso NÃO é
 * um iPhone de verdade (não simula a barra do Safari nem o teclado do iOS), mas pega
 * a grande maioria dos problemas de layout. Ver README › Testes no iPhone.
 */
const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const AUTH = "e2e/.auth/ana.json";
/** Smoke test contra produção: E2E_BASE_URL=https://larmais.tech pnpm test:smoke (sem servidor local). */
const REMOTE = /^https:\/\//.test(BASE_URL);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1, // os testes compartilham o banco local
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    colorScheme: "dark",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"], storageState: AUTH },
      dependencies: ["setup"],
      testIgnore: /screenshots|smoke/,
    },
    {
      name: "Mobile Safari (iPhone 15)",
      use: { ...devices["iPhone 15"], storageState: AUTH },
      dependencies: ["setup"],
      testIgnore: /screenshots|smoke/,
    },
    {
      name: "Mobile Safari (iPhone SE)",
      use: { ...devices["iPhone SE (3rd gen)"], storageState: AUTH },
      dependencies: ["setup"],
      testIgnore: /screenshots|smoke/,
    },
    {
      name: "Mobile Chrome (Android 360x800)",
      use: { ...devices["Pixel 7"], viewport: { width: 360, height: 800 }, storageState: AUTH },
      dependencies: ["setup"],
      testIgnore: /screenshots|smoke/,
    },
    // Smoke de PRODUÇÃO (pnpm test:smoke): usuário de teste dedicado, sem dados reais.
    { name: "smoke", testMatch: /smoke\.spec\.ts/, use: { ...devices["iPhone 15"] } },
    // Gera as imagens do README (pnpm screenshots). Não roda no `pnpm test:e2e`.
    { name: "screenshots", testMatch: /screenshots\.spec\.ts/, dependencies: ["setup"] },
  ],
  webServer: REMOTE ? undefined : {
    command: process.env.CI ? `pnpm start --port ${PORT}` : `pnpm dev --port ${PORT}`,
    url: `${BASE_URL}/entrar`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // E2E sem IA real (determinístico, sem gastar cota).
    env: { ASSISTANT_AI_ENABLED: "false" },
  },
});
