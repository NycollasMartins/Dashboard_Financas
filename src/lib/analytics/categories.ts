/*
 * Junta as linhas por categoria vindas do banco (folha = subcategoria) em
 * categorias "raiz" com suas subcategorias, e anexa período anterior e média.
 * A agregação pesada é no SQL; aqui só se reorganizam ~30 linhas.
 */

export type CategoryRow = {
  categoryId: string | null;
  parentId: string | null;
  totalCents: number;
  plannedCents: number;
};

export type CategoryMeta = { id: string; name: string; color: string; icon: string };

export type CategoryNode = {
  /** null = "Sem categoria". */
  id: string | null;
  name: string;
  color: string;
  icon: string;
  totalCents: number;
  plannedCents: number;
  /** Fração do total do período (0–1). */
  share: number;
  previousCents: number;
  /** Média MENSAL dos 3 meses anteriores, já ajustada ao tamanho do período. */
  averageCents: number;
  children: { id: string | null; name: string; totalCents: number }[];
};

const UNCATEGORIZED = { name: "Sem categoria", color: "#64748b", icon: "ellipsis" };

function rootOf(row: CategoryRow) {
  return row.parentId ?? row.categoryId;
}

function sumByRoot(rows: readonly CategoryRow[]) {
  const m = new Map<string | null, number>();
  for (const r of rows) m.set(rootOf(r), (m.get(rootOf(r)) ?? 0) + r.totalCents);
  return m;
}

export function buildCategoryTree(
  current: readonly CategoryRow[],
  previous: readonly CategoryRow[],
  average3m: readonly CategoryRow[],
  meta: ReadonlyMap<string, CategoryMeta>,
  periodMonths = 1,
): CategoryNode[] {
  const grand = current.reduce((acc, r) => acc + r.totalCents, 0);
  const prev = sumByRoot(previous);
  const avg = sumByRoot(average3m);
  const nodes = new Map<string | null, CategoryNode>();

  for (const r of current) {
    const root = rootOf(r);
    let node = nodes.get(root);
    if (!node) {
      const m = root ? meta.get(root) : undefined;
      node = {
        id: root,
        name: m?.name ?? UNCATEGORIZED.name,
        color: m?.color ?? UNCATEGORIZED.color,
        icon: m?.icon ?? UNCATEGORIZED.icon,
        totalCents: 0,
        plannedCents: 0,
        share: 0,
        previousCents: prev.get(root) ?? 0,
        averageCents: Math.round(((avg.get(root) ?? 0) / 3) * periodMonths),
        children: [],
      };
      nodes.set(root, node);
    }
    node.totalCents += r.totalCents;
    node.plannedCents += r.plannedCents;
    if (r.parentId) {
      node.children.push({ id: r.categoryId, name: (r.categoryId && meta.get(r.categoryId)?.name) || "—", totalCents: r.totalCents });
    }
  }

  return [...nodes.values()]
    .map((n) => ({
      ...n,
      share: grand > 0 ? n.totalCents / grand : 0,
      children: n.children.sort((a, b) => b.totalCents - a.totalCents),
    }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

/**
 * Para a barra segmentada: as `max` maiores categorias e o resto somado em
 * "Outras" (nunca gerar uma cor nova para a 7ª categoria).
 */
export function topWithOthers(nodes: readonly CategoryNode[], max = 5) {
  if (nodes.length <= max + 1) return { top: [...nodes], others: null as null | { totalCents: number; share: number; count: number } };
  const top = nodes.slice(0, max);
  const rest = nodes.slice(max);
  return {
    top,
    others: {
      totalCents: rest.reduce((a, n) => a + n.totalCents, 0),
      share: rest.reduce((a, n) => a + n.share, 0),
      count: rest.length,
    },
  };
}
