import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const sharedResolve = {
  tsconfigPaths: true,
  alias: { "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)) },
};

/** Testes de integração (precisam do Supabase local: pnpm db:start). */
export default defineConfig({
  resolve: sharedResolve,
  test: { environment: "node", include: ["src/**/*.integration.ts"], fileParallelism: false, testTimeout: 30_000, hookTimeout: 30_000 },
});
