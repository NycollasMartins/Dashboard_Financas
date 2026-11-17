import "server-only";
import { cache } from "react";
import { buildCategoryTree, type CategoryMeta } from "@/lib/analytics/categories";
import type { DateRange, Period } from "@/lib/analytics/period";
import {
  getByCategory,
  getMonthly,
  getPosition,
  getTotals,
  getUpcoming,
  type AnalyticsScope,
} from "@/lib/data/analytics";
import type { LedgerLookups } from "@/lib/data/ledger";

/*
 * Vários blocos do painel usam os mesmos números (ex.: a árvore de categorias
 * alimenta o gráfico, a comparação e os insights). `cache` do React deduplica
 * por requisição — mas compara argumentos por identidade, então a chave é uma
 * string JSON.
 */

const key = (scope: AnalyticsScope, range?: DateRange) => JSON.stringify({ scope, range });

const totalsBy = cache((k: string) => {
  const { scope, range } = JSON.parse(k);
  return getTotals(scope, range);
});
export const loadTotals = (scope: AnalyticsScope, range: DateRange) => totalsBy(key(scope, range));

const positionBy = cache((k: string, until: string) => getPosition(JSON.parse(k).scope, until));
export const loadPosition = (scope: AnalyticsScope, until: string) => positionBy(key(scope), until);

const monthlyBy = cache((k: string) => {
  const { scope, range } = JSON.parse(k);
  return getMonthly(scope, range);
});
export const loadMonthly = (scope: AnalyticsScope, range: DateRange) => monthlyBy(key(scope, range));

export const loadUpcoming = cache((workspaceId: string) => getUpcoming(workspaceId, 15));

const treeBy = cache(async (k: string, metaKey: string) => {
  const { scope, period } = JSON.parse(k) as { scope: AnalyticsScope; period: Period };
  const meta = new Map<string, CategoryMeta>(JSON.parse(metaKey));
  const [current, previous, average] = await Promise.all([
    getByCategory(scope, period),
    getByCategory(scope, period.previous),
    getByCategory(scope, period.average),
  ]);
  return buildCategoryTree(current, previous, average, meta, period.months);
});

export function loadCategoryTree(scope: AnalyticsScope, period: Period, lookups: LedgerLookups) {
  const meta = lookups.categories.map((c) => [c.id, { id: c.id, name: c.name, color: c.color, icon: c.icon }] as const);
  return treeBy(JSON.stringify({ scope, period }), JSON.stringify(meta));
}
