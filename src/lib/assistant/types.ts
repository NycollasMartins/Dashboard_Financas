import { z } from "zod";
import type { ISODate } from "@/lib/dates";
import type { Period } from "./dates";

/*
 * CONTRATO da interpretação (ADR-0018). A IA (ou o parser local) só devolve
 * isto: uma INTENÇÃO estruturada. Nada aqui grava ou calcula. Qualquer coisa
 * fora do schema é rejeitada (proteção contra prompt injection).
 */

export const INTENTS = [
  "registrar_despesa",
  "registrar_receita",
  "registrar_compra_parcelada",
  "transferir",
  "guardar_em_meta",
  "retirar_de_meta",
  "confirmar_previsto",
  "consultar",
  "desfazer_ultimo",
  "ajuda",
] as const;
export type Intent = (typeof INTENTS)[number];

export const QUERY_TOPICS = ["gastos", "receitas", "saldo", "fatura", "meta", "falta_guardar", "resumo"] as const;
export type QueryTopic = (typeof QUERY_TOPICS)[number];

export const PAYMENTS = ["pix", "debit", "credit", "cash", "transfer", "boleto"] as const;
export type Payment = (typeof PAYMENTS)[number];

const name = z.string().trim().max(80).nullish();

/** Um item como a IA deve devolver (JSON). Campos desconhecidos são descartados. */
export const aiItemSchema = z.object({
  intent: z.enum(INTENTS),
  amount: z.union([z.number(), z.string().max(40)]).nullish(),
  description: z.string().trim().max(140).nullish(),
  category: name,
  payment: z.enum(PAYMENTS).nullish(),
  card: name,
  account: name,
  to_account: name,
  goal: name,
  installments: z.coerce.number().int().min(1).max(48).nullish(),
  date: z.string().max(40).nullish(),
  topic: z.enum(QUERY_TOPICS).nullish(),
  period: z.string().max(40).nullish(),
  workspace: z.enum(["familia", "individual"]).nullish(),
});
export const aiOutputSchema = z.object({ items: z.array(aiItemSchema).min(1).max(5) });
export type AiItem = z.infer<typeof aiItemSchema>;

/** Item já normalizado pelo SISTEMA (centavos, datas ISO). */
export type ParsedItem = {
  intent: Intent;
  amountCents: number | null;
  description: string | null;
  category: string | null;
  payment: Payment | null;
  card: string | null;
  account: string | null;
  toAccount: string | null;
  goal: string | null;
  installments: number | null;
  date: ISODate | null;
  topic: QueryTopic | null;
  period: Period | null;
  workspace: "familia" | "individual" | null;
};

export type Provider = "local" | "gemini" | "groq" | "mock";

export type Interpretation = {
  items: ParsedItem[];
  /** 0–1. Abaixo do limiar o sistema tenta a IA. */
  confidence: number;
  provider: Provider;
  /** Por que caiu numa camada (cota, erro, sem chave…). */
  notes?: string[];
};

/** Nomes do espaço — o ÚNICO contexto enviado à IA (nunca saldos, valores ou e-mails). */
export type NameContext = {
  categories: { name: string; kind: "income" | "expense" }[];
  accounts: string[];
  cards: string[];
  goals: string[];
  /** Regras aprendidas: padrão normalizado → nome da categoria. */
  rules?: { pattern: string; category: string }[];
};

export const emptyItem = (intent: Intent): ParsedItem => ({
  intent,
  amountCents: null,
  description: null,
  category: null,
  payment: null,
  card: null,
  account: null,
  toAccount: null,
  goal: null,
  installments: null,
  date: null,
  topic: null,
  period: null,
  workspace: null,
});
