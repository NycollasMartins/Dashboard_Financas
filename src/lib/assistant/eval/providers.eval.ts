import { readFileSync } from "node:fs";
import { describe, it } from "vitest";
import { interpret, normalizeAiItem } from "../interpret";
import { parseLocal } from "../local-parser";
import { GeminiParser } from "../providers/gemini";
import { GroqParser } from "../providers/groq";
import { ProviderError, type AiParser } from "../providers/types";
import { aiOutputSchema, type Interpretation } from "../types";
import { DATASET, EVAL_CONTEXT, EVAL_TODAY, HOLDOUT } from "./dataset";
import { printReport, scoreCase, summarize, type CaseResult } from "./score";

/*
 * AVALIAÇÃO MANUAL contra o provedor REAL (fora do CI; gasta cota!).
 *   EVAL_PROVIDER=gemini pnpm eval:assistant      (ou groq)
 *   EVAL_LIMIT=40  → só as 40 primeiras mensagens
 *   EVAL_DELAY_MS=4500 → pausa entre chamadas (respeita o limite por minuto)
 *   EVAL_SET=holdout → usa as 40 mensagens do holdout (padrão: dataset principal)
 * 429 (limite por minuto) → espera e tenta de novo (até 4x), para não
 * contar "limite estourado" como erro de interpretação.
 * Mede a IA SOZINHA (todas as mensagens vão para ela) e o PIPELINE (local
 * primeiro, IA só quando o local não tem confiança). Chaves lidas de .env.local.
 */
for (const line of (() => { try { return readFileSync(".env.local", "utf8").split("\n"); } catch { return []; } })()) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const which = process.env.EVAL_PROVIDER ?? "local";
const SET = process.env.EVAL_SET === "holdout" ? HOLDOUT : DATASET;
const limit = Number(process.env.EVAL_LIMIT ?? SET.length);
const delay = Number(process.env.EVAL_DELAY_MS ?? 4500);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe(`avaliação: ${which}`, () => {
  it("roda o conjunto", { timeout: 60 * 60_000 }, async () => {
    const cases = SET.slice(0, limit);
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
    const latencies: number[] = [];
    for (const [text, exp] of cases) {
      let raw: unknown = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const t0 = performance.now();
          raw = await p.parse({ text, nowLocal: `${EVAL_TODAY}T10:00`, names: EVAL_CONTEXT }, AbortSignal.timeout(20_000));
          latencies.push(performance.now() - t0);
          break;
        } catch (e) {
          if (e instanceof ProviderError && e.status === 429 && attempt < 4) {
            await sleep(20_000);
            continue;
          }
          errors++;
          console.log(`erro em "${text}": ${(e as Error).message}`);
          break;
        }
      }
      const parsed = raw == null ? null : aiOutputSchema.safeParse(raw);
      if (raw != null && !parsed?.success) errors++;
      const ai: Interpretation = parsed?.success
        ? { items: parsed.data.items.map((it) => normalizeAiItem(it, text, EVAL_TODAY, EVAL_CONTEXT)), confidence: 0.85, provider: p.name }
        : { items: [], confidence: 0, provider: p.name };
      aiOnly.push(scoreCase(text, exp, ai));
      // Pipeline REAL: interpret() com a resposta já obtida (não gasta 2ª chamada).
      const cached: AiParser = { name: "mock", supportsImages: false, available: () => true,
        parse: async () => { if (raw == null) throw new Error("sem resposta"); return raw; } };
      const out = await interpret(text, { today: EVAL_TODAY, nowLocal: `${EVAL_TODAY}T10:00`, names: EVAL_CONTEXT,
        providers: [cached], takeQuota: async () => ({ allowed: true }) });
      pipeline.push(scoreCase(text, exp, out));
      await sleep(delay);
    }
    printReport(`IA sozinha (${which})`, summarize(aiOnly));
    printReport(`Pipeline local → ${which}`, summarize(pipeline));
    console.log(`Respostas inválidas/erros: ${errors}`);
    const sorted = [...latencies].sort((a, b) => a - b);
    const pct = (q: number) => (sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] / 1000).toFixed(1);
    if (sorted.length) console.log(`Tempo de resposta: mediana ${pct(0.5)} s · p95 ${pct(0.95)} s · máx ${pct(1)} s · >8 s: ${sorted.filter((x) => x > 8000).length}`);
    for (const f of summarize(aiOnly).failures) console.log(`✗ ${f.text} → ${f.got}`);
  });
});
