import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // "server-only" lança erro fora do Next; nos testes é um módulo vazio.
    alias: { "server-only": new URL("./src/test/server-only-stub.ts", import.meta.url).pathname },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Avaliação do assistente (inclusive contra provedor real) roda à parte: pnpm eval:assistant
    exclude: ["**/node_modules/**", "src/**/*.eval.ts"],
  },
});
