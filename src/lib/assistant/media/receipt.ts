import { z } from "zod";
import { addDays } from "@/lib/analytics/period";
import type { ISODate } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { parseLocal } from "../local-parser";
import { parseAmount } from "../money";
import { normalize } from "../normalize";
import { PAYMENTS, type NameContext, type ParsedItem } from "../types";

/*
 * LEITURA DE FOTOS (ADR-0022): a IA só EXTRAI campos de um cupom/nota/print.
 * Tudo aqui é puro (testável): formato esperado, limpeza de dados pessoais,
 * validação (soma × total, data plausível, valor > 0) e montagem dos itens.
 * A foto nunca é guardada; o que fica é só o lançamento + "origem: foto".
 */

export const DOC_TYPES = ["nfce", "cupom", "recibo", "notificacao_cartao", "comprovante_pix", "fatura", "outro"] as const;
export type DocType = (typeof DOC_TYPES)[number];
export const DOC_LABEL: Record<DocType, string> = {
  nfce: "Nota fiscal (NFC-e)",
  cupom: "Cupom",
  recibo: "Recibo",
  notificacao_cartao: "Notificação de compra no cartão",
  comprovante_pix: "Comprovante de Pix/transferência",
  fatura: "Fatura",
  outro: "Documento",
};

const conf = z.coerce.number().min(0).max(1).catch(0.5);
const money = z.union([z.number(), z.string().max(40)]).nullish();

/** Saída do modelo. Campos desconhecidos são descartados; nada de CPF/CNPJ aqui. */
export const receiptSchema = z.object({
  is_receipt: z.boolean(),
  legible: z.boolean().default(true),
  doc_type: z.enum(DOC_TYPES).catch("outro"),
  merchant: z.string().trim().max(120).nullish(),
  total: money,
  date: z.string().max(20).nullish(),
  payment: z.enum(PAYMENTS).nullish().catch(null),
  card_last4: z.string().regex(/^\d{4}$/).nullish().catch(null),
  category: z.string().trim().max(80).nullish(),
  items: z.array(z.object({
    description: z.string().trim().max(120),
    amount: money,
    category: z.string().trim().max(80).nullish(),
  })).max(60).default([]),
  confidence: z.object({ merchant: conf, total: conf, date: conf, payment: conf, items: conf }).partial().default({}),
});
export type RawReceipt = z.infer<typeof receiptSchema>;

export type ReceiptItem = { description: string; amountCents: number; category: string | null };
export type Receipt = {
  docType: DocType;
  merchant: string | null;
  totalCents: number;
  date: ISODate | null;
  payment: (typeof PAYMENTS)[number] | null;
  cardLast4: string | null;
  category: string | null;
  items: ReceiptItem[];
  confidence: Partial<Record<"merchant" | "total" | "date" | "payment" | "items", number>>;
  warnings: string[];
};

// Identificadores pessoais que NUNCA podem sair daqui (nem em log, nem no banco).
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const CNPJ = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const PHONE = /\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b/g;
const CHAVE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/** Remove CPF, CNPJ, e-mail, telefone e chave Pix aleatória de um texto. */
export function scrubPII(text: string): string {
  return text.replace(CNPJ, "").replace(CPF, "").replace(EMAIL, "").replace(CHAVE, "").replace(PHONE, "")
    .replace(/\b(cpf|cnpj|consumidor)\b[:\s]*/gi, "").replace(/\s{2,}/g, " ").trim();
}

const nameIn = (value: string | null | undefined, options: string[]) => {
  if (!value) return null;
  const n = normalize(value);
  return options.find((o) => normalize(o) === n) ?? null;
};

function parseDate(v: string | null | undefined): ISODate | null {
  if (!v) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (iso) return v as ISODate;
  const br = /^(\d{2})\/(\d{2})\/(\d{2,4})$/.exec(v);
  if (br) return `${br[3].length === 2 ? `20${br[3]}` : br[3]}-${br[2]}-${br[1]}` as ISODate;
  return null;
}

export type ReceiptResult = { ok: true; receipt: Receipt } | { ok: false; reason: "not_receipt" | "illegible" | "no_total" };

/** Valida e normaliza a extração. `today` em São Paulo. */
export function validateReceipt(raw: RawReceipt, today: ISODate, names: NameContext): ReceiptResult {
  if (!raw.is_receipt) return { ok: false, reason: "not_receipt" };
  if (!raw.legible) return { ok: false, reason: "illegible" };
  const totalCents = parseAmount(raw.total ?? null);
  if (!totalCents || totalCents <= 0) return { ok: false, reason: "no_total" };

  const expenseCats = names.categories.filter((c) => c.kind === "expense").map((c) => c.name);
  const warnings: string[] = [];
  const items: ReceiptItem[] = raw.items
    .map((it) => ({ description: scrubPII(it.description), amountCents: parseAmount(it.amount ?? null) ?? 0, category: nameIn(it.category, expenseCats) }))
    .filter((it) => it.description && it.amountCents > 0);

  if (items.length) {
    const sum = items.reduce((s, it) => s + it.amountCents, 0);
    // Descontos/troco fazem a soma diferir; mais de R$ 0,05 de diferença = alerta.
    if (Math.abs(sum - totalCents) > 5) {
      warnings.push(`A soma dos itens (${formatBRL(sum)}) difere do total (${formatBRL(totalCents)}) — confira o valor.`);
    }
  }

  let date = parseDate(raw.date);
  if (date && (date > addDays(today, 1) || date < addDays(today, -365))) {
    warnings.push(`A data lida (${date.split("-").reverse().join("/")}) não parece certa — usei hoje.`);
    date = null;
  } else if (date && date < addDays(today, -60)) {
    warnings.push("O comprovante tem mais de 60 dias — confira a data.");
  }

  const merchant = raw.merchant ? scrubPII(raw.merchant).slice(0, 80) || null : null;
  // Categoria: 1º regras aprendidas/sinônimos (parser local), 2º sugestão da IA.
  const local = merchant ? parseLocal(`${merchant} 1`, today, names).items[0] : null;
  const category = local?.category ?? nameIn(raw.category, expenseCats);

  return {
    ok: true,
    receipt: {
      docType: raw.doc_type,
      merchant,
      totalCents,
      date,
      payment: raw.payment ?? null,
      cardLast4: raw.card_last4 ?? null,
      category,
      items,
      confidence: raw.confidence,
      warnings,
    },
  };
}

/** Item único (o total) para o fluxo normal de confirmação. */
export function receiptToItem(r: Receipt): ParsedItem {
  return {
    intent: "registrar_despesa",
    amountCents: r.totalCents,
    description: r.merchant ?? DOC_LABEL[r.docType],
    category: r.category,
    payment: r.payment,
    card: null,
    account: null,
    toAccount: null,
    goal: null,
    installments: null,
    date: r.date,
    topic: null,
    period: null,
    workspace: null,
  };
}

/**
 * "Dividir por categoria" (ex.: mercado + farmácia na mesma nota): agrupa os itens
 * por categoria. Só é oferecido quando há ≥ 2 categorias e a soma dos itens bate
 * com o total (senão os valores não fecham).
 */
export function splitByCategory(r: Receipt): ParsedItem[] | null {
  if (r.items.length < 2) return null;
  const sum = r.items.reduce((s, it) => s + it.amountCents, 0);
  if (Math.abs(sum - r.totalCents) > 5) return null;
  const groups = new Map<string, number>();
  for (const it of r.items) {
    const key = it.category ?? r.category ?? "";
    groups.set(key, (groups.get(key) ?? 0) + it.amountCents);
  }
  if (groups.size < 2) return null;
  // Arredondamento: a diferença (≤ 5 centavos) vai para o maior grupo → soma = total.
  const entries = [...groups.entries()].sort((a, b) => b[1] - a[1]);
  entries[0][1] += r.totalCents - sum;
  return entries.map(([category, cents]) => ({
    ...receiptToItem(r),
    amountCents: cents,
    category: category || null,
    description: `${r.merchant ?? DOC_LABEL[r.docType]}${category ? ` · ${category}` : ""}`.slice(0, 140),
  }));
}

/** Texto auditado no lugar da foto (sem dados pessoais, sem a imagem). */
const PAYMENT_LABEL: Record<string, string> = {
  pix: "Pix", debit: "débito", credit: "crédito", cash: "dinheiro", boleto: "boleto", transfer: "transferência",
};

export function receiptSummary(r: Receipt): string {
  const parts = [
    DOC_LABEL[r.docType],
    r.merchant,
    formatBRL(r.totalCents),
    r.date ? r.date.split("-").reverse().join("/") : null,
    r.cardLast4 ? `cartão final ${r.cardLast4}` : r.payment ? (PAYMENT_LABEL[r.payment] ?? r.payment) : null,
    r.items.length ? `${r.items.length} ${r.items.length === 1 ? "item" : "itens"}` : null,
  ].filter(Boolean);
  return `[foto] ${parts.join(" · ")}`;
}

export const PHOTO_TIPS =
  "Não consegui ler um comprovante nessa imagem. Dicas: foto de frente, com boa luz, o cupom inteiro no quadro e sem dobras. Prints de notificação ou de comprovante Pix também funcionam.";
