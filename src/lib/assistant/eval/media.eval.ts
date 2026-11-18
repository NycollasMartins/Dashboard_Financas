import { readFileSync } from "node:fs";
import { describe, it } from "vitest";
import { interpret } from "../interpret";
import { receiptSchema, validateReceipt } from "../media/receipt";
import { normalize } from "../normalize";
import { GeminiParser } from "../providers/gemini";
import { GroqParser } from "../providers/groq";
import type { AiParser } from "../providers/types";
import { EVAL_CONTEXT, EVAL_TODAY } from "./dataset";
import { AUDIOS, RECEIPTS } from "./media-dataset";

/*
 * AVALIAÇÃO MANUAL de FOTOS e ÁUDIOS com os provedores REAIS (fora do CI; gasta cota!).
 *   EVAL_MEDIA=photos pnpm eval:assistant src/lib/assistant/eval/media.eval.ts
 *   EVAL_MEDIA=audio  pnpm eval:assistant src/lib/assistant/eval/media.eval.ts
 *   EVAL_AUDIO_PROVIDER=gemini → mede a transcrição reserva (padrão: groq/Whisper)
 * Imagens e áudios sintéticos (scripts/generate-media-eval.mjs).
 */
for (const line of (() => { try { return readFileSync(".env.local", "utf8").split("\n"); } catch { return []; } })()) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const DIR = "src/lib/assistant/eval/media";
const which = process.env.EVAL_MEDIA ?? "photos";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(0)}% (${a}/${b})` : "—");

describe(`avaliação de mídia: ${which}`, () => {
  it.runIf(which === "photos")("fotos de comprovantes", { timeout: 20 * 60_000 }, async () => {
    const gemini = new GeminiParser();
    if (!gemini.available()) return console.log("⚠ sem GEMINI_API_KEY");
    const f: Record<string, [number, number]> = {};
    const hit = (k: string, ok: boolean) => { f[k] ??= [0, 0]; f[k][0] += ok ? 1 : 0; f[k][1]++; };
    const times: number[] = [];
    for (const r of RECEIPTS) {
      const base64 = readFileSync(`${DIR}/receipts/${r.file}`).toString("base64");
      let raw: unknown = null;
      const t0 = performance.now();
      for (let i = 0; i < 3 && raw == null; i++) {
        try {
          raw = await gemini.extractReceipt({ image: { mimeType: "image/png", base64 }, nowLocal: `${EVAL_TODAY}T10:00`, names: EVAL_CONTEXT }, AbortSignal.timeout(30_000));
        } catch (e) { console.log(`  erro ${r.file}: ${(e as Error).message}`); await sleep(5000); }
      }
      times.push(performance.now() - t0);
      const parsed = receiptSchema.safeParse(raw);
      const v = parsed.success ? validateReceipt(parsed.data, EVAL_TODAY, EVAL_CONTEXT) : null;
      const rec = v?.ok ? v.receipt : null;
      const got = parsed.success ? parsed.data : null;
      hit("é comprovante?", got?.is_receipt === r.isReceipt);
      if (r.legible === false) hit("detecta ilegível", got?.legible === false || !rec);
      if (r.forbidden) hit("sem CPF/CNPJ/contato", !r.forbidden.some((x) => JSON.stringify(rec ?? {}).includes(x)));
      if (r.isReceipt && r.legible !== false) {
        if (r.totalCents) hit("total", rec?.totalCents === r.totalCents);
        if (r.date) hit("data", rec?.date === r.date);
        if (r.merchantIncludes) hit("estabelecimento", normalize(rec?.merchant ?? "").includes(normalize(r.merchantIncludes)));
        if (r.payment) hit("forma de pagamento", rec?.payment === r.payment);
        if (r.cardLast4) hit("final do cartão", rec?.cardLast4 === r.cardLast4);
        if (r.minItems) hit("itens lidos", (rec?.items.length ?? 0) >= r.minItems);
      }
      console.log(`${r.file}: ${rec ? `${rec.merchant} · ${rec.totalCents} · ${rec.date} · ${rec.payment} · final ${rec.cardLast4} · ${rec.items.length} itens · ${rec.category}${rec.warnings.length ? ` · ⚠ ${rec.warnings.length}` : ""}` : `não lançável (${got ? `is_receipt=${got.is_receipt} legible=${got.legible}` : "resposta inválida"})`}`);
      await sleep(4500);
    }
    console.log("\n=== FOTOS (Gemini) — acurácia por campo ===");
    for (const [k, [a, b]] of Object.entries(f)) console.log(`  ${k.padEnd(22)} ${pct(a, b)}`);
    const s = [...times].sort((a, b) => a - b);
    console.log(`  tempo: mediana ${(s[Math.floor(s.length / 2)] / 1000).toFixed(1)} s · máx ${(s.at(-1)! / 1000).toFixed(1)} s`);
  });

  it.runIf(which === "audio")("áudios (transcrição + pipeline)", { timeout: 20 * 60_000 }, async () => {
    const transcriber: AiParser = process.env.EVAL_AUDIO_PROVIDER === "gemini" ? new GeminiParser() : new GroqParser();
    if (!transcriber.available()) return console.log(`⚠ sem chave para ${transcriber.name}`);
    const textProviders = [new GeminiParser(), new GroqParser()].filter((p) => p.available());
    let words = 0, intents = 0, amounts = 0, amountTotal = 0;
    const times: number[] = [];
    for (const a of AUDIOS) {
      const base64 = readFileSync(`${DIR}/audio/${a.file}`).toString("base64");
      let text = "";
      const t0 = performance.now();
      try {
        text = await transcriber.transcribe!({ mimeType: "audio/ogg", base64, filename: a.file }, AbortSignal.timeout(20_000));
      } catch (e) { console.log(`  erro ${a.file}: ${(e as Error).message}`); }
      times.push(performance.now() - t0);
      const n = normalize(text);
      const okWords = a.mustContain.every((w) => n.includes(w));
      const out = await interpret(text, { today: EVAL_TODAY, nowLocal: `${EVAL_TODAY}T10:00`, names: EVAL_CONTEXT, providers: textProviders, takeQuota: async () => ({ allowed: true }) });
      const it0 = out.items[0];
      const okIntent = it0?.intent === a.intent;
      words += okWords ? 1 : 0;
      intents += okIntent ? 1 : 0;
      if (a.amountCents) {
        amountTotal++;
        if (out.items.some((i) => i.amountCents === a.amountCents)) amounts++;
      }
      console.log(`${okWords && okIntent ? "✓" : "✗"} ${a.file} “${a.text}” → “${text}” → ${it0?.intent ?? "—"} ${it0?.amountCents ?? ""} (${out.provider})`);
      await sleep(3500);
    }
    console.log(`\n=== ÁUDIO (${transcriber.name}) ===`);
    console.log(`  transcrição com o essencial  ${pct(words, AUDIOS.length)}`);
    console.log(`  intenção correta (pipeline)  ${pct(intents, AUDIOS.length)}`);
    console.log(`  valor correto                ${pct(amounts, amountTotal)}`);
    const s = [...times].sort((x, y) => x - y);
    console.log(`  tempo transcrição: mediana ${(s[Math.floor(s.length / 2)] / 1000).toFixed(1)} s · máx ${(s.at(-1)! / 1000).toFixed(1)} s`);
  });
});
