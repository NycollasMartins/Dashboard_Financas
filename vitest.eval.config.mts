import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const sharedResolve = {
  tsconfigPaths: true,
  alias: { "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)) },
};

/** Avaliação manual do assistente (pnpm eval:assistant) — pode chamar a IA real. */
export default defineConfig({
  resolve: sharedResolve,
  test: { environment: "node", include: ["src/**/*.eval.ts"], silent: false },
});
