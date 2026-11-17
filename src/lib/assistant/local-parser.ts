import type { ISODate } from "@/lib/dates";
import { findDate, findPeriod } from "./dates";
import { findAmounts } from "./money";
import { mentions, normalize, stripAccents } from "./normalize";
import { EXPENSE_SYNONYMS, INCOME_SYNONYMS } from "./synonyms";
import { emptyItem, type Interpretation, type NameContext, type ParsedItem, type Payment, type QueryTopic } from "./types";

/*
 * PARSER LOCAL (sem IA) — 1ª camada (ADR-0019). Resolve os casos simples e
 * frequentes de forma determinística, sem gastar cota e sem enviar nada para
 * fora. Devolve uma confiança 0–1: abaixo de CONFIDENT o sistema tenta a IA.
 */

export const CONFIDENT = 0.8;

const RX = {
  undo: /^(desfaz|desfazer|desfaca|desfazer o ultimo|cancela(r)? (o |a )?ultim[oa]|apaga(r)? (o |a )?ultim[oa]|volta(r)? (o |a )?ultim[oa]|errei|anula(r)? (o |a )?ultim[oa])\b/,
  help: /^(ajuda|help|menu|comandos|o que (voce|vc) (faz|sabe|pode)|como (funciona|usar|uso)|oi|ola|e ai|bom dia|boa tarde|boa noite|\?)\b/,
  question: /\b(quanto|qual|quais|como (esta|ta|estao|tao)|mostra|mostrar|ver|me (diz|fala|mostra)|resumo|balanco)\b/,
  withdraw: /\b(tirei|retirei|resgatei|saquei|usei|peguei|tire|retire|resgatar|retirar|tirar)\b/,
  save: /\b(guardei|guardar|guarda|guarde|poupei|reservei|separei|apliquei|depositei|botei|coloquei|juntei|economizei)\b/,
  transfer: /\b(transferi|transfere|transferir|transferencia|passei|mandei|movi|joguei)\b/,
  confirmVerb: /^(ja )?(paguei|pago|quitei|recebi|caiu|chegou|confirma(r)?|marca(r)? como pag[oa])\b/,
  income: /\b(ganhei|recebi|recebido|entrou|caiu|salario|freela|freelance|bico|vendi|reembolso|rendimento|rendeu|me pagaram|me pagou|me deu|me deram|decimo terceiro|13o|bonus|extra|pix recebido)\b/,
  expense: /\b(gastei|gasto|gastar|paguei|pagar|paga|comprei|compra|torrei|custou|deu|foi|abasteci|almocei|jantei|pedi|tomei|comi|lanchei|gastamos|pagamos|compramos)\b/,
  installments: /\b(\d{1,2})\s*x\b|\bem (\d{1,2}) (?:vezes|parcelas|prestacoes)\b|\b(\d{1,2}) parcelas\b/,
  family: /\b(na|da|pra|para a|no espaco da) (familia|casa)\b/,
  personal: /\b(no|do|pro|para o) (meu )?(individual|pessoal|espaco individual)\b|\bso meu\b/,
};

const PAYMENT_RX: [RegExp, Payment][] = [
  [/\b(no |de |cartao de )?credito\b|\bno cartao\b|\bcartao\b/, "credit"],
  [/\b(no )?debito\b/, "debit"],
  [/\bpix\b/, "pix"],
  [/\b(em |no )?dinheiro\b|\bespecie\b|\bcash\b|\bvivo\b(?= em dinheiro)/, "cash"],
  [/\bboleto\b/, "boleto"],
  [/\b(ted|doc|transferencia bancaria)\b/, "transfer"],
];

const STOP = new Set(
  ("de do da dos das no na nos nas em um uma uns umas o a os as e com pra pro para por pelo pela que ja eu me meu minha " +
    "hoje ontem anteontem dia reais real r$ conto contos pila pilas paus mil k reais foi era agora ai la aqui esse essa " +
    "isso isto tambem so mais vez vezes parcela parcelas x credito debito cartao pix dinheiro boleto ted gastei paguei " +
    "comprei torrei gasto gastar pagar paga compra custou deu abasteci almocei jantei pedi tomei comi lanchei ganhei recebi " +
    "recebido entrou caiu vendi me pagaram pagou guardei guardar guarda poupei reservei separei apliquei depositei botei " +
    "coloquei juntei tirei retirei resgatei saquei usei peguei transferi transfere transferir passei mandei movi meta " +
    "familia casa individual pessoal espaco passada passado semana na sexta sabado domingo segunda terca quarta quinta valor total " +
    "gastamos pagamos compramos lanche comida tava estava ta").split(" "),
);

function title(s: string) {
  const t = s.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

function findCategory(text: string, kind: "income" | "expense", ctx: NameContext): string | null {
  const exists = (n: string) => ctx.categories.find((c) => c.kind === kind && stripAccents(c.name.toLowerCase()) === stripAccents(n.toLowerCase()));
  for (const r of ctx.rules ?? []) {
    if (text.includes(r.pattern)) {
      const c = ctx.categories.find((x) => x.name === r.category);
      if (c) return c.name;
    }
  }
  const list = kind === "expense" ? EXPENSE_SYNONYMS : INCOME_SYNONYMS;
  for (const [pattern, cat] of list) {
    if (new RegExp(`(^|\\s)${pattern}($|\\s)`).test(text)) {
      const c = exists(cat);
      if (c) return c.name;
    }
  }
  // Nome da própria categoria no texto ("50 em lazer")
  const direct = ctx.categories.filter((c) => c.kind === kind).find((c) => mentions(text, c.name));
  return direct?.name ?? null;
}

function findNamed(text: string, names: string[]) {
  const hits = names
    .map((n) => ({ n, i: text.indexOf(normalize(n)) }))
    .filter((h) => h.i >= 0 || mentions(text, h.n))
    .map((h) => ({ ...h, i: h.i >= 0 ? h.i : 9999 }));
  return hits.sort((a, b) => a.i - b.i);
}

function describe(segment: string, ctx: NameContext, removeSpans: [number, number][]): string | null {
  let s = segment;
  for (const [a, b] of [...removeSpans].sort((x, y) => y[0] - x[0])) s = s.slice(0, a) + " " + s.slice(b);
  for (const n of [...ctx.cards, ...ctx.accounts, ...ctx.goals]) s = s.replace(new RegExp(`\\b${normalize(n)}\\b`, "g"), " ");
  const words = s
    .replace(/r\$/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w));
  return words.length ? title(words.slice(0, 6).join(" ")) : null;
}

function queryTopic(t: string, ctx: NameContext): { topic: QueryTopic; goal?: string; card?: string; category?: string } | null {
  if (!RX.question.test(t) && !/\?\s*$/.test(t) && !/^(saldo|fatura|resumo|gastos?)\b/.test(t)) return null;
  const goal = findNamed(t, ctx.goals)[0]?.n;
  if (/\bfatura\b/.test(t)) return { topic: "fatura", card: findNamed(t, ctx.cards)[0]?.n };
  if (/\b(falta|preciso|tenho que|devo) guardar\b|\bquanto guardar\b/.test(t)) return { topic: "falta_guardar" };
  if (goal || /\bmetas?\b/.test(t)) return { topic: "meta", goal };
  if (/\bsaldo\b|\bquanto (eu )?tenho\b|\bquanto sobrou\b|\bquanto (eu )?ainda tenho\b/.test(t)) return { topic: "saldo" };
  if (/\bquanto (eu )?(ganhei|recebi|entrou)\b|\breceitas?\b/.test(t)) return { topic: "receitas", category: findCategory(t, "income", ctx) ?? undefined };
  if (/\bresumo\b|\bbalanco\b|\bcomo (estou|to|tou|estao|tao) (as )?(financas|contas|gastos)\b/.test(t)) return { topic: "resumo" };
  if (/\b(gastei|gasto|gastos|gastamos|ja gastei|torrei|despesas?|paguei)\b/.test(t)) return { topic: "gastos", category: findCategory(t, "expense", ctx) ?? undefined };
  return null;
}

function parseSegment(seg: string, verbContext: string, today: ISODate, ctx: NameContext): { item: ParsedItem; confidence: number } {
  const amounts = findAmounts(seg);
  const amount = amounts[0] ?? null;
  const date = findDate(seg, today);
  const inst = RX.installments.exec(seg);
  const installments = inst ? Number(inst[1] ?? inst[2] ?? inst[3]) : null;
  const full = `${verbContext} ${seg}`;
  const cards = findNamed(seg, ctx.cards);
  const accounts = findNamed(seg, ctx.accounts);
  const goals = findNamed(seg, ctx.goals);
  let payment: Payment | null = null;
  for (const [rx, p] of PAYMENT_RX) if (rx.test(seg)) { payment = p; break; }

  let item: ParsedItem;
  let conf = 0.5;
  const spans: [number, number][] = [];
  if (amount) spans.push([amount.start, amount.end]);
  if (date) spans.push([date.start, date.end]);
  if (inst) spans.push([inst.index, inst.index + inst[0].length]);

  if (RX.withdraw.test(full) && (goals.length || /\b(meta|reserva|caixinha)\b/.test(seg))) {
    item = { ...emptyItem("retirar_de_meta"), goal: goals[0]?.n ?? null };
    conf += 0.3;
    item.description = describe(seg.replace(RX.withdraw, " "), ctx, spans);
  } else if (RX.save.test(full)) {
    let goal: string | null = goals[0]?.n ?? null;
    if (!goal) {
      const m = /\b(?:pra|para|na|no|pro) (?:a |o |meta )?([a-z0-9 ]{3,30})$/.exec(seg.replace(/\s+\d.*$/, "").trim());
      goal = m ? title(m[1]) : null;
    }
    item = { ...emptyItem("guardar_em_meta"), goal };
    conf += goal && goals.length ? 0.35 : 0.15;
  } else if (RX.transfer.test(full) && (accounts.length >= 2 || /\b(da|do) .+ (pra|para|pro) /.test(seg))) {
    item = { ...emptyItem("transferir"), account: accounts[0]?.n ?? null, toAccount: accounts[1]?.n ?? null };
    conf += accounts.length >= 2 ? 0.3 : 0.05;
  } else if (!amount && RX.confirmVerb.test(seg)) {
    item = { ...emptyItem("confirmar_previsto"), description: describe(seg.replace(RX.confirmVerb, " "), ctx, spans) };
    conf += item.description ? 0.35 : 0;
  } else if (RX.income.test(full) && !RX.expense.test(seg.replace(/\bpagou\b/, ""))) {
    item = { ...emptyItem("registrar_receita"), category: findCategory(full, "income", ctx) };
    conf += 0.3;
    if (item.category) conf += 0.1;
  } else {
    const parcelada = installments !== null && installments >= 2;
    item = { ...emptyItem(parcelada ? "registrar_compra_parcelada" : "registrar_despesa"), installments: parcelada ? installments : null };
    item.category = findCategory(seg, "expense", ctx) ?? findCategory(full, "expense", ctx);
    if (RX.expense.test(full) || parcelada) conf += 0.3;
    else if (amount && item.category) conf += 0.2; // "100 mercado"
    if (item.category) conf += 0.1;
    if (parcelada) payment = "credit";
  }

  // Valor obrigatório (menos em confirmar previsto)
  if (item.intent !== "confirmar_previsto") {
    if (amount) conf += 0.15;
    else conf -= 0.25;
    item.amountCents = amount?.cents ?? null;
  }
  if (amounts.length > 1) conf -= 0.2; // ambíguo dentro do mesmo item
  // Gasto/receita sem categoria reconhecida: deixa a IA tentar categorizar.
  if (["registrar_despesa", "registrar_receita", "registrar_compra_parcelada"].includes(item.intent) && !item.category) conf = Math.min(conf, 0.75);
  item.date = date?.date ?? null;
  item.payment = payment;
  // Cartão × conta: o resolvedor decide se o mesmo nome existir nos dois.
  if (cards[0] && (payment === "credit" || !accounts.length || item.intent === "registrar_compra_parcelada")) item.card = cards[0].n;
  if (accounts[0] && item.intent !== "transferir" && !item.card) item.account = accounts[0].n;
  if (cards[0] && accounts.length && !payment && item.intent === "registrar_despesa") {
    item.card = cards[0].n; // ambíguo → o resolvedor pergunta
    item.account = accounts[0].n;
  }
  if (!item.description && ["registrar_despesa", "registrar_receita", "registrar_compra_parcelada"].includes(item.intent)) {
    item.description = describe(seg, ctx, spans);
  }
  return { item, confidence: Math.max(0, Math.min(1, conf)) };
}

/** Interpreta a mensagem sem IA. */
export function parseLocal(text: string, today: ISODate, ctx: NameContext): Interpretation {
  let t = normalize(text);
  if (!t) return { items: [], confidence: 0, provider: "local" };
  let workspace: ParsedItem["workspace"] = null;
  if (RX.family.test(t)) workspace = "familia";
  else if (RX.personal.test(t)) workspace = "individual";
  t = t.replace(RX.family, " ").replace(RX.personal, " ").replace(/\s+/g, " ").trim();

  const amounts = findAmounts(t);
  if (RX.undo.test(t)) return { items: [{ ...emptyItem("desfazer_ultimo"), workspace }], confidence: 0.95, provider: "local" };
  if (RX.help.test(t) && amounts.length === 0 && !RX.question.test(t.replace(/^\s*(oi|ola|bom dia|boa tarde|boa noite)\b/, ""))) {
    return { items: [emptyItem("ajuda")], confidence: 0.9, provider: "local" };
  }
  const q = amounts.length === 0 ? queryTopic(t, ctx) : null;
  if (q) {
    return {
      items: [{ ...emptyItem("consultar"), topic: q.topic, goal: q.goal ?? null, card: q.card ?? null, category: q.category ?? null, period: findPeriod(t, today), workspace }],
      confidence: 0.9,
      provider: "local",
    };
  }

  // Vários lançamentos numa mensagem: separa em "e", vírgula, "mais", "+".
  let segments = [t];
  if (amounts.length > 1) {
    const parts = t.split(/\s*(?:,|;|\be\b|\bmais\b|\+|\btambem\b)\s*/).filter(Boolean);
    const withAmount: string[] = [];
    for (const p of parts) {
      if (findAmounts(p).length) withAmount.push(p);
      else if (withAmount.length) withAmount[withAmount.length - 1] += ` ${p}`;
      else withAmount.push(p);
    }
    if (withAmount.filter((p) => findAmounts(p).length).length > 1) {
      // Texto antes do 1º valor sem valor próprio ("gastei") vira contexto, não item.
      segments = withAmount.filter((p) => findAmounts(p).length);
      if (!findAmounts(withAmount[0]).length) segments[0] = `${withAmount[0]} ${segments[0]}`;
    }
  }
  const verbContext = segments.length > 1 ? (/(\w+ei)\b/.exec(t)?.[1] ?? "") : "";
  const parsed = segments.map((s) => parseSegment(s, verbContext, today, ctx));
  const items = parsed.map((p) => ({ ...p.item, workspace }));
  const confidence = parsed.length ? Math.min(...parsed.map((p) => p.confidence)) : 0;
  return { items, confidence, provider: "local" };
}
