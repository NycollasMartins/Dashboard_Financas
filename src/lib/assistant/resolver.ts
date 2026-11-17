import type { ISODate } from "@/lib/dates";
import { normalize } from "./normalize";
import type { ParsedItem, Payment } from "./types";

/*
 * RESOLVEDOR: transforma um item interpretado (nomes) em uma AÇÃO concreta
 * (ids), ou em uma PERGUNTA quando falta dado obrigatório ou há ambiguidade.
 * Puro (recebe os lookups) e testado. Quem grava é o executor via API interna.
 */

export type Lookups = {
  workspaceId: string;
  categories: { id: string; name: string; kind: "income" | "expense" }[];
  accounts: { id: string; name: string }[];
  cards: { id: string; name: string }[];
  goals: { id: string; name: string; status: string; reserveAccountId: string | null; planAccountId: string | null }[];
  defaultAccountId: string | null;
};

export type EntryAction = {
  type: "entry";
  kind: "expense" | "income" | "transfer";
  amountCents: number;
  description: string | null;
  occurredOn: ISODate;
  categoryId: string | null;
  paymentMethod: Payment;
  accountId: string | null;
  toAccountId: string | null;
  cardId: string | null;
  installments: number;
};
export type GoalAction = {
  type: "goal";
  kind: "deposit" | "withdrawal";
  goalId: string;
  amountCents: number;
  contributedOn: ISODate;
  accountId: string | null;
  note: string | null;
};
export type Action = EntryAction | GoalAction;

export type Option = { label: string; value: string };
export type Question = { field: "amount" | "card" | "payment_target" | "from" | "to" | "goal" | "note"; text: string; options?: Option[] };

export type Resolution =
  | { status: "ready"; action: Action }
  | { status: "question"; question: Question; item: ParsedItem }
  | { status: "error"; message: string };

const byName = <T extends { name: string }>(list: T[], name: string | null) =>
  name ? (list.find((x) => normalize(x.name) === normalize(name)) ?? null) : null;

/** Aplica uma resposta do usuário (escolha/valor) a um item pendente. */
export function applyAnswer(item: ParsedItem, field: Question["field"], value: string, lk: Lookups): ParsedItem {
  switch (field) {
    case "amount": return { ...item, amountCents: Number(value) || null };
    case "card": return { ...item, card: lk.cards.find((c) => c.id === value)?.name ?? null, payment: "credit" };
    case "payment_target": {
      const card = lk.cards.find((c) => c.id === value);
      if (card) return { ...item, card: card.name, account: null, payment: "credit" };
      const acc = lk.accounts.find((a) => a.id === value);
      return { ...item, account: acc?.name ?? null, card: null, payment: item.payment === "credit" || !item.payment ? "pix" : item.payment };
    }
    case "from": return { ...item, account: lk.accounts.find((a) => a.id === value)?.name ?? null };
    case "to": return { ...item, toAccount: lk.accounts.find((a) => a.id === value)?.name ?? null };
    case "goal": return { ...item, goal: lk.goals.find((g) => g.id === value)?.name ?? null };
    case "note": return { ...item, description: value.trim().slice(0, 200) || null };
  }
}

export function resolveItem(item: ParsedItem, lk: Lookups, today: ISODate): Resolution {
  const date = item.date ?? today;
  if (item.intent === "registrar_despesa" || item.intent === "registrar_receita" || item.intent === "registrar_compra_parcelada") {
    if (!item.amountCents) return { status: "question", item, question: { field: "amount", text: "Qual foi o valor?" } };
    const kind = item.intent === "registrar_receita" ? "income" : "expense";
    const category = lk.categories.find((c) => c.kind === kind && item.category && normalize(c.name) === normalize(item.category)) ?? null;
    const card = byName(lk.cards, item.card);
    const account = byName(lk.accounts, item.account);
    const parcelada = item.intent === "registrar_compra_parcelada" || (item.installments ?? 1) > 1;
    let payment: Payment = item.payment ?? (card || parcelada ? "credit" : "pix");
    if (kind === "income" && payment === "credit") payment = "pix";

    // "no nubank" sem dizer se é crédito ou débito, e existe cartão E conta com esse nome.
    const twin = card && !account ? lk.accounts.find((a) => normalize(a.name).includes(normalize(card.name))) ?? null : account;
    if (kind === "expense" && card && twin && !item.payment && !parcelada) {
      const account = twin;
      return {
        status: "question",
        item,
        question: {
          field: "payment_target",
          text: "Foi no cartão de crédito ou saiu da conta?",
          options: [
            { label: `Cartão ${card.name} (crédito)`, value: card.id },
            { label: `${account.name} (débito/pix)`, value: account.id },
          ],
        },
      };
    }
    if (payment === "credit") {
      const c = card ?? (lk.cards.length === 1 ? lk.cards[0] : null);
      if (!c) {
        if (!lk.cards.length) return { status: "error", message: "Você ainda não cadastrou cartão. Cadastre em Cartões ou diga a forma de pagamento (pix, débito…)." };
        return { status: "question", item, question: { field: "card", text: "Em qual cartão?", options: lk.cards.map((x) => ({ label: x.name, value: x.id })) } };
      }
      return {
        status: "ready",
        action: {
          type: "entry", kind: "expense", amountCents: item.amountCents, description: item.description, occurredOn: date,
          categoryId: category?.id ?? null, paymentMethod: "credit", accountId: null, toAccountId: null, cardId: c.id,
          installments: Math.max(1, Math.min(48, item.installments ?? 1)),
        },
      };
    }
    return {
      status: "ready",
      action: {
        type: "entry", kind, amountCents: item.amountCents, description: item.description, occurredOn: date,
        categoryId: category?.id ?? null, paymentMethod: payment, accountId: account?.id ?? lk.defaultAccountId ?? lk.accounts[0]?.id ?? null,
        toAccountId: null, cardId: null, installments: 1,
      },
    };
  }

  if (item.intent === "transferir") {
    if (!item.amountCents) return { status: "question", item, question: { field: "amount", text: "Qual o valor da transferência?" } };
    const from = byName(lk.accounts, item.account);
    const to = byName(lk.accounts, item.toAccount);
    const opts = lk.accounts.map((a) => ({ label: a.name, value: a.id }));
    if (lk.accounts.length < 2) return { status: "error", message: "Para transferir, cadastre pelo menos duas contas." };
    if (!from) return { status: "question", item, question: { field: "from", text: "De qual conta saiu?", options: opts } };
    if (!to) return { status: "question", item, question: { field: "to", text: "Para qual conta foi?", options: opts.filter((o) => o.value !== from.id) } };
    if (from.id === to.id) return { status: "error", message: "A conta de origem e a de destino são a mesma." };
    return {
      status: "ready",
      action: {
        type: "entry", kind: "transfer", amountCents: item.amountCents, description: item.description, occurredOn: date,
        categoryId: null, paymentMethod: "transfer", accountId: from.id, toAccountId: to.id, cardId: null, installments: 1,
      },
    };
  }

  if (item.intent === "guardar_em_meta" || item.intent === "retirar_de_meta") {
    const active = lk.goals.filter((g) => g.status !== "archived");
    if (!active.length) return { status: "error", message: "Você ainda não tem metas. Crie uma em Metas." };
    if (!item.amountCents) return { status: "question", item, question: { field: "amount", text: item.intent === "guardar_em_meta" ? "Quanto você guardou?" : "Quanto você tirou?" } };
    const goal = byName(active, item.goal) ?? (item.goal ? active.find((g) => normalize(g.name).includes(normalize(item.goal!))) : null) ?? null;
    if (!goal) return { status: "question", item, question: { field: "goal", text: "Para qual meta?", options: active.map((g) => ({ label: g.name, value: g.id })) } };
    const withdrawal = item.intent === "retirar_de_meta";
    if (withdrawal && !item.description) return { status: "question", item: { ...item, goal: goal.name }, question: { field: "note", text: "Qual o motivo da retirada?" } };
    const accountId = byName(lk.accounts, item.account)?.id ?? goal.planAccountId ?? lk.defaultAccountId ?? lk.accounts.find((a) => a.id !== goal.reserveAccountId)?.id ?? null;
    return {
      status: "ready",
      action: {
        type: "goal", kind: withdrawal ? "withdrawal" : "deposit", goalId: goal.id, amountCents: item.amountCents, contributedOn: date,
        accountId: accountId === goal.reserveAccountId ? null : accountId, note: withdrawal ? item.description : null,
      },
    };
  }
  return { status: "error", message: "Ainda não sei fazer isso." };
}
