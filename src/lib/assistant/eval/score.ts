import { CONFIDENT } from "../local-parser";
import { stripAccents } from "../normalize";
import type { Interpretation, ParsedItem } from "../types";
import type { Expect } from "./dataset";

/*
 * Placar da avaliação: acerto de intenção (todos os itens, na ordem) e acerto
 * por campo (só os campos esperados). Também mede, para o parser local,
 * COBERTURA (quantas ele resolve sozinho com confiança) e PRECISÃO quando
 * confiante (se errar com confiança, a IA nem é chamada — o pior caso).
 */

const FIELDS = ["amount", "category", "payment", "card", "account", "toAccount", "goal", "installments", "date", "topic", "workspace"] as const;
type Field = (typeof FIELDS)[number];

const eq = (a: unknown, b: unknown) =>
  typeof a === "string" && typeof b === "string" ? stripAccents(a.toLowerCase()) === stripAccents(b.toLowerCase()) : a === b;

function fieldValue(item: ParsedItem, f: Field): unknown {
  switch (f) {
    case "amount": return item.amountCents === null ? null : item.amountCents / 100;
    default: return item[f as keyof ParsedItem] ?? null;
  }
}

export type CaseResult = { text: string; intentOk: boolean; fieldsOk: Partial<Record<Field, boolean>>; confident: boolean; got: string };

export function scoreCase(text: string, exp: Expect, out: Interpretation): CaseResult {
  const intents = Array.isArray(exp.intent) ? exp.intent : [exp.intent];
  const intentOk = out.items.length === intents.length && out.items.every((it, i) => it.intent === intents[i]);
  const fieldsOk: CaseResult["fieldsOk"] = {};
  for (const f of FIELDS) {
    const e = exp[f as keyof Expect];
    if (e === undefined) continue;
    const expected = Array.isArray(e) ? e : [e];
    fieldsOk[f] = expected.every((v, i) => out.items[i] !== undefined && eq(fieldValue(out.items[i], f), v));
  }
  return {
    text,
    intentOk,
    fieldsOk,
    confident: out.confidence >= CONFIDENT,
    got: out.items.map((i) => `${i.intent}${i.amountCents ? ` ${i.amountCents / 100}` : ""}${i.category ? ` [${i.category}]` : ""}`).join(" | ") || "(nada)",
  };
}

export type Report = {
  total: number;
  intentAccuracy: number;
  fieldAccuracy: Partial<Record<Field, { ok: number; total: number; pct: number }>>;
  /** Casos 100% corretos (intenção + todos os campos esperados). */
  exact: number;
  coverage: number;
  precisionWhenConfident: number;
  failures: CaseResult[];
};

export function summarize(results: CaseResult[]): Report {
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  const fieldAccuracy: Report["fieldAccuracy"] = {};
  for (const f of FIELDS) {
    const rel = results.filter((r) => r.fieldsOk[f] !== undefined);
    if (rel.length) {
      const ok = rel.filter((r) => r.fieldsOk[f]).length;
      fieldAccuracy[f] = { ok, total: rel.length, pct: pct(ok, rel.length) };
    }
  }
  const allOk = (r: CaseResult) => r.intentOk && Object.values(r.fieldsOk).every(Boolean);
  const confident = results.filter((r) => r.confident);
  return {
    total: results.length,
    intentAccuracy: pct(results.filter((r) => r.intentOk).length, results.length),
    fieldAccuracy,
    exact: pct(results.filter(allOk).length, results.length),
    coverage: pct(confident.length, results.length),
    precisionWhenConfident: pct(confident.filter(allOk).length, confident.length),
    failures: results.filter((r) => !allOk(r)),
  };
}

export function printReport(name: string, r: Report) {
  const lines = [
    `\n=== ${name} — ${r.total} mensagens ===`,
    `Intenção: ${r.intentAccuracy}% · Caso inteiro correto: ${r.exact}%`,
    `Cobertura com confiança: ${r.coverage}% · Precisão quando confiante: ${r.precisionWhenConfident}%`,
    ...Object.entries(r.fieldAccuracy).map(([f, v]) => `  ${f.padEnd(12)} ${String(v!.pct).padStart(5)}%  (${v!.ok}/${v!.total})`),
  ];
  console.log(lines.join("\n"));
}
