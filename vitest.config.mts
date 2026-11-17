import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const sharedResolve = {
  tsconfigPaths: true,
  // "server-only" lança erro fora do Next; nos testes é um módulo vazio.
  alias: { "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)) },
};

export default defineConfig({
  resolve: sharedResolve,
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Integração (precisa do banco) e avaliação contra IA real rodam à parte.
    exclude: ["**/node_modules/**", "src/**/*.eval.ts", "src/**/*.integration.ts"],
  },
});
