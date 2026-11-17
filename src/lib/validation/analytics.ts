import { z } from "zod";

/** Filtros do dashboard na URL (link compartilhável; voltar funciona). */
export const dashboardFiltersSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/).optional().catch(undefined),
  ano: z.string().regex(/^\d{4}$/).optional().catch(undefined),
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  visao: z.enum(["competencia", "caixa"]).optional().catch(undefined),
  categoria: z.uuid().optional().catch(undefined),
  membro: z.uuid().optional().catch(undefined),
  conta: z.uuid().optional().catch(undefined),
  cartao: z.uuid().optional().catch(undefined),
});
export type DashboardFilters = z.infer<typeof dashboardFiltersSchema>;

/** Converte searchParams (string | string[]) em objeto simples e valida. */
export function parseDashboardFilters(sp: Record<string, string | string[] | undefined>): DashboardFilters {
  const flat = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  return dashboardFiltersSchema.parse(flat);
}
