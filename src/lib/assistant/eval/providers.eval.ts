import { readFileSync } from "node:fs";
import { describe, it } from "vitest";
import { normalizeAiItem } from "../interpret";
import { parseLocal } from "../local-parser";
import { GeminiParser } from "../providers/gemini";
import { GroqParser } from "../providers/groq";
import type { AiParser } from "../providers/types";
import { aiOutputSchema, type Interpretation } from "../types";
import { DATASET, EVAL_CONTEXT, EVAL_TODAY } from "./dataset";
import { printReport, scoreCase, summarize, type CaseResult } from "./score";

/*
 * AVALIAÇÃO MANUAL contra o provedor REAL (fora do CI; gasta cota!).
 *   EVAL_PROVIDER=gemini pnpm eval:assistant      (ou groq)
 *   EVAL_LIMIT=40  → só as 40 primeiras mensagens
 *   EVAL_DELAY_MS=4500 → pausa entre chamadas (respeita o limite por minuto)
 * Mede a IA SOZINHA (todas as mensagens vão para ela) e o PIPELINE (local
 * primeiro, IA só quando o local não tem confiança). Chaves lidas de .env.local.
 */
for (const line of (() => { try { return readFileSync(".env.local", "utf8").split("\n"); } catch { return []; } })()) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const which = process.env.EVAL_PROVIDER ?? "local";
const limit = Number(process.env.EVAL_LIMIT ?? DATASET.length);
const delay = Number(process.env.EVAL_DELAY_MS ?? 4500);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe(`avaliação: ${which}`, () => {
  it("roda o conjunto", { timeout: 60 * 60_000 }, async () => {
    const cases = DATASET.slice(0, limit);
    if (which === "local") {
      printReport("Parser local", summarize(cases.map(([t, e]) => scoreCase(t, e, parseLocal(t, EVAL_TODAY, EVAL_CONTEXT)))));
      return;
    }
    const p: AiParser = which === "groq" ? new GroqParser() : new GeminiParser();
    if (!p.available()) {
      console.log(`⚠ ${which}: chave não configurada em .env.local — nada a avaliar.`);
      return;
    }
    const aiOnly: CaseResult[] = [];
    const pipeline: CaseResult[] = [];
    let errors = 0;
    for (const [text, exp] of cases) {
      const local = parseLocal(text, EVAL_TODAY, EVAL_CONTEXT);
      let ai: Interpretation = { items: [], confidence: 0, provider: p.name };
      try {
        const raw = await p.parse({ text, nowLocal: `${EVAL_TODAY}T10:00`, names: EVAL_CONTEXT });
        const parsed = aiOutputSchema.safeParse(raw);
        if (parsed.success) ai = { items: parsed.data.items.map((it) => normalizeAiItem(it, text, EVAL_TODAY, EVAL_CONTEXT)), confidence: 0.85, provider: p.name };
        else errors++;
      } catch (e) {
        errors++;
        console.log(`erro em "${text}": ${(e as Error).message}`);
      }
      aiOnly.push(scoreCase(text, exp, ai));
      pipeline.push(scoreCase(text, exp, local.confidence >= 0.8 ? local : ai.items.length ? ai : local));
      await sleep(delay);
    }
    printReport(`IA sozinha (${which})`, summarize(aiOnly));
    printReport(`Pipeline local → ${which}`, summarize(pipeline));
    console.log(`Respostas inválidas/erros: ${errors}`);
    for (const f of summarize(aiOnly).failures) console.log(`✗ ${f.text} → ${f.got}`);
  });
});
