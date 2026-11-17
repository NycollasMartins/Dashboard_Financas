import { formatBRL } from "@/lib/money";
import type { Action, Lookups } from "./resolver";

/* Textos das respostas (o SISTEMA formata; a IA nunca escreve a resposta). */

const PAYMENT_LABEL: Record<string, string> = { pix: "Pix", debit: "Débito", credit: "Crédito", cash: "Dinheiro", transfer: "Transferência", boleto: "Boleto" };
const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
export const shortDate = (iso: string) => dateFmt.format(new Date(`${iso}T12:00:00Z`));

export type ActionView = {
  title: string;
  amountCents: number;
  kind: "expense" | "income" | "transfer" | "deposit" | "withdrawal";
  lines: string[];
  categoryId: string | null;
  categoryKind: "expense" | "income" | null;
  date: string;
};

export function describeAction(a: Action, lk: Lookups, today: string): ActionView {
  const cat = a.type === "entry" && a.categoryId ? lk.categories.find((c) => c.id === a.categoryId) : null;
  const when = a.type === "entry" ? a.occurredOn : a.contributedOn;
  const dateLine = when === today ? "hoje" : shortDate(when);
  if (a.type === "goal") {
    const goal = lk.goals.find((g) => g.id === a.goalId)?.name ?? "meta";
    const acc = lk.accounts.find((x) => x.id === a.accountId)?.name;
    return {
      title: a.kind === "deposit" ? `Guardar para ${goal}` : `Retirar de ${goal}`,
      amountCents: a.amountCents,
      kind: a.kind,
      lines: [dateLine, acc ? (a.kind === "deposit" ? `sai de ${acc}` : `volta para ${acc}`) : "", a.note ? `motivo: ${a.note}` : ""].filter(Boolean),
      categoryId: null,
      categoryKind: null,
      date: when,
    };
  }
  if (a.kind === "transfer") {
    const from = lk.accounts.find((x) => x.id === a.accountId)?.name ?? "?";
    const to = lk.accounts.find((x) => x.id === a.toAccountId)?.name ?? "?";
    return { title: "Transferência", amountCents: a.amountCents, kind: "transfer", lines: [`${from} → ${to}`, dateLine], categoryId: null, categoryKind: null, date: when };
  }
  const card = lk.cards.find((x) => x.id === a.cardId)?.name;
  const acc = lk.accounts.find((x) => x.id === a.accountId)?.name;
  const where = card ? `Cartão ${card}${a.installments > 1 ? ` · ${a.installments}x de ${formatBRL(Math.floor(a.amountCents / a.installments))}` : ""}` : [PAYMENT_LABEL[a.paymentMethod], acc].filter(Boolean).join(" · ");
  return {
    title: a.description || cat?.name || (a.kind === "income" ? "Receita" : "Despesa"),
    amountCents: a.amountCents,
    kind: a.kind,
    lines: [cat?.name ?? "Sem categoria", where, dateLine].filter(Boolean),
    categoryId: a.categoryId,
    categoryKind: a.kind,
    date: when,
  };
}

export function summaryLine(v: ActionView) {
  const sign = v.kind === "income" ? "+" : v.kind === "transfer" ? "" : v.kind === "deposit" ? "🎯 " : v.kind === "withdrawal" ? "↩ " : "−";
  return `${sign}${formatBRL(v.amountCents)} · ${v.title} (${v.lines.join(" · ")})`;
}

export const HELP_TEXT = [
  "Eu registro e consulto suas finanças por mensagem. Exemplos:",
  "• “gastei 50 no uber” · “100 mercado no débito”",
  "• “ganhei 1000 de freela” · “caiu o salário”",
  "• “comprei uma TV de 3000 em 10x no nubank”",
  "• “guardei 300 pra viagem” · “tirei 200 da reserva”",
  "• “transferi 500 da conta nubank pra poupança”",
  "• “paguei o aluguel” (confirma o previsto)",
  "• “quanto gastei com mercado?” · “fatura do nubank” · “como está a meta do carro?”",
  "• “desfazer” (apaga o último registro feito por aqui)",
].join("\n");
