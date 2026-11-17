import "server-only";
import { endOfMonth } from "@/lib/analytics/period";
import { monthStart, type ISODate } from "@/lib/dates";
import { listarMetas } from "@/lib/goals/service";
import { formatBRL } from "@/lib/money";
import type { Ctx } from "@/lib/service-result";
import { shortDate } from "../format";
import type { Lookups } from "../resolver";
import type { ParsedItem } from "../types";

/*
 * Respostas de CONSULTA: calculadas pelo banco (funções analíticas da Fase 3/4,
 * com RLS) e escritas por template. A IA só identificou a pergunta.
 */

const monthLabel = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

export async function answerQuery(ctx: Ctx, lk: Lookups, item: ParsedItem, today: ISODate): Promise<string> {
  const sb = ctx.supabase;
  const ws = lk.workspaceId;
  const period = item.period ?? { from: monthStart(today), to: endOfMonth(monthStart(today)), label: "neste mês", key: "mes" as const };
  const to = period.to;
  switch (item.topic) {
    case "gastos":
    case "receitas": {
      const kind = item.topic === "gastos" ? "expense" : "income";
      const cat = item.category ? lk.categories.find((c) => c.kind === kind && c.name === item.category) : null;
      const { data, error } = await sb.rpc("analytics_totals", {
        p_workspace_id: ws, p_from: period.from, p_to: to, p_basis: "accrual", p_category_id: cat?.id,
      }).single();
      if (error) throw error;
      const done = kind === "expense" ? data.expense_cents : data.income_cents;
      const planned = kind === "expense" ? data.expense_planned_cents : data.income_planned_cents;
      const verb = kind === "expense" ? "gastou" : "recebeu";
      let text = `Você ${verb} ${formatBRL(done)}${cat ? ` com ${cat.name}` : ""} ${period.label}.`;
      if (planned > 0) text += ` Ainda há ${formatBRL(planned)} previsto.`;
      if (!cat && done > 0) {
        const top = await sb.rpc("analytics_by_category", { p_workspace_id: ws, p_from: period.from, p_to: to, p_kind: kind });
        const byRoot = new Map<string, number>();
        for (const r of top.data ?? []) {
          const id = r.parent_id ?? r.category_id ?? "none";
          byRoot.set(id, (byRoot.get(id) ?? 0) + r.total_cents);
        }
        const lines = [...byRoot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
          .map(([id, v]) => `${lk.categories.find((c) => c.id === id)?.name ?? "Sem categoria"} ${formatBRL(v)}`);
        if (lines.length) text += `\nMaiores: ${lines.join(" · ")}.`;
      }
      return text;
    }
    case "saldo": {
      const { data, error } = await sb.from("account_balances").select("name, balance_cents").eq("workspace_id", ws).is("archived_at", null).order("name");
      if (error) throw error;
      if (!data.length) return "Você ainda não cadastrou contas.";
      const total = data.reduce((a, r) => a + (r.balance_cents ?? 0), 0);
      return `Saldo das contas: ${formatBRL(total)}\n${data.map((r) => `• ${r.name}: ${formatBRL(r.balance_cents ?? 0)}`).join("\n")}`;
    }
    case "fatura": {
      const cards = item.card ? lk.cards.filter((c) => c.name === item.card) : lk.cards;
      if (!cards.length) return "Você ainda não cadastrou cartões.";
      const lines: string[] = [];
      for (const c of cards) {
        const { data } = await sb.from("card_invoice_summaries").select("due_date, total_cents, remaining_cents, status")
          .eq("card_id", c.id).gte("due_date", today).order("due_date").limit(1);
        const inv = data?.[0];
        lines.push(inv
          ? `Fatura ${c.name} (vence ${shortDate(inv.due_date ?? today)}, ${inv.status === "open" ? "aberta" : inv.status === "closed" ? "fechada" : inv.status === "paid" ? "paga" : "vencida"}): ${formatBRL(inv.total_cents ?? 0)}${inv.remaining_cents !== inv.total_cents ? `, faltam ${formatBRL(inv.remaining_cents ?? 0)}` : ""}`
          : `Cartão ${c.name}: nenhuma fatura a vencer.`);
      }
      return lines.join("\n");
    }
    case "meta": {
      const res = await listarMetas({ ...ctx, today }, ws);
      if (!res.ok) return res.message;
      const goals = res.data.filter((g) => g.status === "active" || g.status === "achieved");
      const pick = item.goal ? goals.filter((g) => g.name === item.goal) : goals;
      if (!pick.length) return "Você ainda não tem metas ativas.";
      return pick.map((g) => {
        const base = `${g.name}: ${formatBRL(g.savedCents)} de ${formatBRL(g.targetCents)} (${Math.round(g.progress.pct * 100)}%).`;
        if (g.progress.done) return `${base} Concluída! 🎉`;
        const req = g.required.kind === "monthly" ? ` Para o prazo, guarde ${formatBRL(g.required.monthlyCents)}/mês.` : g.required.kind === "overdue" ? " O prazo já passou." : "";
        const est = g.estimate.date ? ` No ritmo atual chega em ${monthLabel(g.estimate.date)}${g.estimate.status === "behind" ? ` (atrasada ${g.estimate.deltaMonths} ${g.estimate.deltaMonths === 1 ? "mês" : "meses"})` : g.estimate.status === "ahead" ? " (adiantada)" : ""}.` : "";
        return `${base} Faltam ${formatBRL(g.progress.remainingCents)}.${req}${est}`;
      }).join("\n");
    }
    case "falta_guardar": {
      const res = await listarMetas({ ...ctx, today }, ws);
      if (!res.ok) return res.message;
      const m0 = monthStart(today);
      const { data } = await sb.from("goal_contributions").select("goal_id, amount_cents").eq("workspace_id", ws)
        .eq("is_planned", false).gte("contributed_on", m0).lte("contributed_on", today);
      const doneBy = new Map<string, number>();
      for (const r of data ?? []) doneBy.set(r.goal_id, (doneBy.get(r.goal_id) ?? 0) + r.amount_cents);
      const lines = res.data
        .filter((g) => g.status === "active" && g.required.kind === "monthly")
        .map((g) => ({ g, left: Math.max(0, (g.required.monthlyCents ?? 0) - (doneBy.get(g.id) ?? 0)) }));
      if (!lines.length) return "Nenhuma meta com prazo ativa — não há valor mensal obrigatório.";
      const total = lines.reduce((a, l) => a + l.left, 0);
      return `Falta guardar ${formatBRL(total)} este mês para manter os prazos:\n${lines.map((l) => `• ${l.g.name}: ${formatBRL(l.left)}`).join("\n")}`;
    }
    case "resumo":
    default: {
      const m0 = monthStart(today);
      const [t, s] = await Promise.all([
        sb.rpc("analytics_totals", { p_workspace_id: ws, p_from: m0, p_to: endOfMonth(m0) }).single(),
        sb.rpc("analytics_savings", { p_workspace_id: ws, p_from: m0, p_to: today }).single(),
      ]);
      if (t.error) throw t.error;
      const inc = t.data.income_cents;
      const exp = t.data.expense_cents;
      return [
        `Resumo de ${monthLabel(m0)}:`,
        `• Receitas: ${formatBRL(inc)}${t.data.income_planned_cents ? ` (+${formatBRL(t.data.income_planned_cents)} previsto)` : ""}`,
        `• Despesas: ${formatBRL(exp)}${t.data.expense_planned_cents ? ` (+${formatBRL(t.data.expense_planned_cents)} previsto)` : ""}`,
        `• Saldo do mês: ${formatBRL(inc - exp)}`,
        `• Guardado em metas: ${formatBRL(s.data?.saved_cents ?? 0)}`,
      ].join("\n");
    }
  }
}
