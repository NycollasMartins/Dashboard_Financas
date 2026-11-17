import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";

const origin = "http://localhost:3000";

describe("safeNextPath", () => {
  it("aceita caminhos internos", () => {
    expect(safeNextPath("/familia", origin)).toBe("/familia");
    expect(safeNextPath("/convite/abc?x=1", origin)).toBe("/convite/abc?x=1");
    expect(safeNextPath("http://localhost:3000/redefinir-senha", origin)).toBe("/redefinir-senha");
  });

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "http://localhost:3001/painel",
    "javascript:alert(1)",
    "/auth/confirm",
  ])("bloqueia %s", (next) => {
    expect(safeNextPath(next, origin)).toBe("/painel");
  });

  it("usa o fallback quando vazio", () => {
    expect(safeNextPath(null, origin, "/x")).toBe("/x");
  });
});
