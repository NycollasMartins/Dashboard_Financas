import { describe, expect, it } from "vitest";
import { DATASET, EVAL_CONTEXT, EVAL_TODAY, HOLDOUT } from "../eval/dataset";
import { printReport, scoreCase, summarize } from "../eval/score";
import { parseLocal } from "../local-parser";

/*
 * Roda o parser local contra o conjunto de avaliação (169 mensagens) e trava
 * regressões. Os números reais vão para o README (Fase 5).
 */
describe("avaliação do parser local", () => {
  const results = DATASET.map(([text, exp]) => scoreCase(text, exp, parseLocal(text, EVAL_TODAY, EVAL_CONTEXT)));
  const report = summarize(results);
  if (process.env.EVAL_VERBOSE) {
    printReport("Parser local", report);
    for (const f of report.failures) console.log(`✗ ${f.text}  →  ${f.got}${f.confident ? "  (CONFIANTE)" : ""}`);
  }

  it("tem pelo menos 150 mensagens", () => expect(report.total).toBeGreaterThanOrEqual(150));
  it("acerta a intenção na grande maioria", () => expect(report.intentAccuracy).toBeGreaterThanOrEqual(90));
  it("acerta o valor", () => expect(report.fieldAccuracy.amount!.pct).toBeGreaterThanOrEqual(95));
  it("quando está confiante, quase nunca erra (senão a IA nem seria chamada)", () =>
    expect(report.precisionWhenConfident).toBeGreaterThanOrEqual(95));
});

describe("holdout (40 mensagens não usadas para ajustar o parser)", () => {
  const report = summarize(HOLDOUT.map(([text, exp]) => scoreCase(text, exp, parseLocal(text, EVAL_TODAY, EVAL_CONTEXT))));
  if (process.env.EVAL_VERBOSE) {
    printReport("Parser local — HOLDOUT", report);
    for (const f of report.failures) console.log(`✗ ${f.text}  →  ${f.got}${f.confident ? "  (CONFIANTE)" : ""}`);
  }
  // Piso para pegar regressões grosseiras; o número real vai para o README.
  it("piso de acerto de intenção", () => expect(report.intentAccuracy).toBeGreaterThanOrEqual(60));
});
