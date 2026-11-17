import type { ISODate } from "@/lib/dates";
import { findPeriod, parseDateValue } from "./dates";
import { CONFIDENT, parseLocal } from "./local-parser";
import { parseAmount } from "./money";
import { normalize } from "./normalize";
import type { AiParser } from "./providers/types";
import { aiOutputSchema, type AiItem, type Interpretation, type NameContext, type ParsedItem } from "./types";

/*
 * PIPELINE DE INTERPRETAÇÃO (ADR-0018/0019):
 *   1) parser local (sem rede, sem cota). Confiante → pronto.
 *   2) provedores em ordem (Gemini → Groq), cada um só se tiver chave E cota.
 *      A saída é validada por schema; intenção fora da lista = descartada.
 *   3) nada deu certo → fica com o resultado do parser local (mesmo incerto)
 *      e o sistema pergunta o que faltar.
 * Nunca grava nada e nunca faz contas.
 */

export type InterpretDeps = {
  today: ISODate;
  nowLocal: string;
  names: NameContext;
  providers: AiParser[];
  /** Reserva 1 chamada de cota (por usuário/dia/provedor e por minuto). */
  takeQuota: (provider: "gemini" | "groq") => Promise<{ allowed: boolean; reason?: string | null }>;
  timeoutMs?: number;
};

const nameOrNull = (value: string | null | undefined, options: string[]) => {
  if (!value) return null;
  const n = normalize(value);
  return options.find((o) => normalize(o) === n) ?? options.find((o) => normalize(o).includes(n) || n.includes(normalize(o))) ?? null;
};

/** Normaliza um item da IA: valores em centavos, datas ISO, nomes só da lista. */
export function normalizeAiItem(it: AiItem, text: string, today: ISODate, names: NameContext): ParsedItem {
  const kind = it.intent === "registrar_receita" ? "income" : "expense";
  const cats = names.categories.filter((c) => c.kind === kind).map((c) => c.name);
  return {
    intent: it.intent,
    amountCents: parseAmount(it.amount ?? null),
    description: it.description?.trim() || null,
    category: nameOrNull(it.category, cats),
    payment: it.payment ?? null,
    card: nameOrNull(it.card, names.cards),
    account: nameOrNull(it.account, names.accounts),
    toAccount: nameOrNull(it.to_account, names.accounts),
    goal: nameOrNull(it.goal, names.goals),
    installments: it.installments ?? null,
    date: parseDateValue(it.date, today),
    topic: it.topic ?? null,
    period: it.intent === "consultar" ? findPeriod(normalize(`${it.period ?? ""} ${text}`), today) : null,
    workspace: it.workspace ?? null,
  };
}

export async function interpret(text: string, deps: InterpretDeps): Promise<Interpretation> {
  const local = parseLocal(text, deps.today, deps.names);
  if (local.confidence >= CONFIDENT) return local;
  const notes: string[] = [`local:${local.confidence.toFixed(2)}`];

  for (const p of deps.providers) {
    if (p.name === "mock" ? !p.available() : !p.available()) {
      notes.push(`${p.name}:sem-chave`);
      continue;
    }
    if (p.name !== "mock") {
      const q = await deps.takeQuota(p.name);
      if (!q.allowed) {
        notes.push(`${p.name}:${q.reason ?? "sem-cota"}`);
        continue;
      }
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), deps.timeoutMs ?? 8000);
    try {
      const raw = await p.parse({ text, nowLocal: deps.nowLocal, names: deps.names }, ctrl.signal);
      const parsed = aiOutputSchema.safeParse(raw);
      if (!parsed.success) {
        notes.push(`${p.name}:schema-invalido`);
        continue;
      }
      const items = parsed.data.items.map((it) => normalizeAiItem(it, text, deps.today, deps.names));
      // A IA não pode "inventar" valor: se ela trouxer valor e o texto não tiver número algum, descarta o valor.
      for (const it of items) if (it.amountCents && !/\d|mil|cem|cento|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|dez|cinco|quinze/.test(normalize(text))) it.amountCents = null;
      return { items, confidence: 0.85, provider: p.name, notes };
    } catch (e) {
      notes.push(`${p.name}:erro${e instanceof Error && "status" in e ? `-${(e as { status: unknown }).status}` : ""}`);
    } finally {
      clearTimeout(timer);
    }
  }
  return { ...local, notes: [...notes, "fallback:local"] };
}
