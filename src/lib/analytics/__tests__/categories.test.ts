import { describe, expect, it } from "vitest";
import { buildCategoryTree, topWithOthers, type CategoryMeta } from "../categories";

const meta = new Map<string, CategoryMeta>([
  ["mercado", { id: "mercado", name: "Mercado", color: "#34d399", icon: "shopping-cart" }],
  ["feira", { id: "feira", name: "Feira", color: "#34d399", icon: "shopping-cart" }],
  ["lazer", { id: "lazer", name: "Lazer", color: "#c084fc", icon: "party-popper" }],
]);

describe("buildCategoryTree", () => {
  const current = [
    { categoryId: "mercado", parentId: null, totalCents: 15000, plannedCents: 0 },
    { categoryId: "feira", parentId: "mercado", totalCents: 5000, plannedCents: 1000 },
    { categoryId: "lazer", parentId: null, totalCents: 20000, plannedCents: 0 },
    { categoryId: null, parentId: null, totalCents: 10000, plannedCents: 0 },
  ];
  const tree = buildCategoryTree(
    current,
    [{ categoryId: "feira", parentId: "mercado", totalCents: 8000, plannedCents: 0 }],
    [{ categoryId: "mercado", parentId: null, totalCents: 30000, plannedCents: 0 }],
    meta,
  );

  it("soma subcategorias no pai e ordena pelo total", () => {
    expect(tree.map((n) => [n.name, n.totalCents])).toEqual([
      ["Mercado", 20000],
      ["Lazer", 20000],
      ["Sem categoria", 10000],
    ]);
    expect(tree[0].children).toEqual([{ id: "feira", name: "Feira", totalCents: 5000 }]);
    expect(tree[0].plannedCents).toBe(1000);
  });
  it("participação, período anterior e média mensal dos 3 meses", () => {
    expect(tree[0].share).toBeCloseTo(0.4);
    expect(tree[0].previousCents).toBe(8000);
    expect(tree[0].averageCents).toBe(10000);
    expect(tree[1].averageCents).toBe(0);
  });
  it("média escala com o tamanho do período (ano = 12 meses)", () => {
    const yearTree = buildCategoryTree(current, [], [{ categoryId: "mercado", parentId: null, totalCents: 30000, plannedCents: 0 }], meta, 12);
    expect(yearTree[0].averageCents).toBe(120000);
  });
  it("sem lançamentos → lista vazia", () => {
    expect(buildCategoryTree([], [], [], meta)).toEqual([]);
  });
});

describe("topWithOthers", () => {
  const nodes = Array.from({ length: 8 }, (_, i) => ({
    id: String(i), name: `C${i}`, color: "#000", icon: "x", totalCents: 100 - i, plannedCents: 0,
    share: 0.1, previousCents: 0, averageCents: 0, children: [],
  }));
  it("agrupa o excedente em Outras", () => {
    const r = topWithOthers(nodes, 5);
    expect(r.top).toHaveLength(5);
    expect(r.others).toEqual({ totalCents: 95 + 94 + 93, share: expect.closeTo(0.3), count: 3 });
  });
  it("não cria 'Outras' para uma categoria só", () => {
    expect(topWithOthers(nodes.slice(0, 6), 5).others).toBeNull();
  });
});
