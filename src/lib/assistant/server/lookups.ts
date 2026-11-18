import "server-only";
import type { Ctx } from "@/lib/service-result";
import type { Lookups } from "../resolver";
import type { NameContext } from "../types";

/** Lookups (ids) para o resolvedor + NOMES (o único contexto que vai para a IA). */
export async function loadLookups(ctx: Ctx, workspaceId: string): Promise<{ lk: Lookups; names: NameContext }> {
  const sb = ctx.supabase;
  const [cats, accs, cards, goals, rules, last] = await Promise.all([
    sb.from("categories").select("id, name, kind").eq("workspace_id", workspaceId).is("archived_at", null),
    sb.from("accounts").select("id, name").eq("workspace_id", workspaceId).is("archived_at", null).order("name"),
    sb.from("credit_cards").select("id, name, last4").eq("workspace_id", workspaceId).is("archived_at", null).order("name"),
    sb.from("goal_summaries").select("goal_id, name, status, reserve_account_id, plan_account_id").eq("workspace_id", workspaceId),
    sb.from("category_rules").select("pattern, category_id").eq("workspace_id", workspaceId),
    sb.from("transactions").select("account_id").eq("workspace_id", workspaceId).eq("created_by", ctx.userId)
      .not("account_id", "is", null).order("created_at", { ascending: false }).limit(1),
  ]);
  for (const r of [cats, accs, cards, goals, rules]) if (r.error) throw r.error;
  const categories = (cats.data ?? []).map((c) => ({ id: c.id, name: c.name, kind: c.kind }));
  const lk: Lookups = {
    workspaceId,
    categories,
    accounts: accs.data ?? [],
    cards: cards.data ?? [],
    goals: (goals.data ?? []).filter((g) => g.status !== "archived").map((g) => ({
      id: g.goal_id!, name: g.name!, status: g.status!, reserveAccountId: g.reserve_account_id, planAccountId: g.plan_account_id,
    })),
    defaultAccountId: last.data?.[0]?.account_id ?? null,
  };
  const names: NameContext = {
    categories: categories.map((c) => ({ name: c.name, kind: c.kind })),
    accounts: lk.accounts.map((a) => a.name),
    cards: lk.cards.map((c) => c.name),
    goals: lk.goals.map((g) => g.name),
    rules: (rules.data ?? [])
      .map((r) => ({ pattern: r.pattern, category: categories.find((c) => c.id === r.category_id)?.name ?? "" }))
      .filter((r) => r.category),
  };
  return { lk, names };
}
