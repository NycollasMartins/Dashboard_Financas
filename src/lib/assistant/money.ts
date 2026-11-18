/*
 * Extração de valores em reais do texto (normalizado) → centavos inteiros.
 * Aceita: "50", "R$ 50,90", "50.90", "1.234,56", "1.500", "50 conto", "50 pila",
 * "1k", "1,5k", "2 mil", "mil e duzentos", "cinquenta reais", "dois mil e quinhentos",
 * fala transcrita (Fase 6): diminutivos ("cinquentinha", "vintinho") e "32 e 50" = R$ 32,50.
 * Ignora números de parcelas ("10x", "em 3 vezes"), dias ("dia 5"), datas (05/11) e %.
 */

export type AmountMatch = { cents: number; start: number; end: number; raw: string };

const UNITS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70,
  oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, quatrocentos: 400,
  quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900,
};

const NUM = String.raw`(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+,\d{1,2}|\d+\.\d{1,2}(?!\d)|\d+)`;
const SUFFIX = String.raw`(?:\s*(k|mil|reais|real|contos?|pilas?|paus?|mangos?|r\$))?`;
const NUMERIC = new RegExp(String.raw`(r\$\s*)?${NUM}${SUFFIX}`, "g");

function toNumber(raw: string): number {
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(raw)) return Number(raw.replace(/\./g, "").replace(",", "."));
  if (raw.includes(",")) return Number(raw.replace(",", "."));
  return Number(raw);
}

// Diminutivos/aumentativos da fala ("cinquentinha no uber", "um vintão").
const SLANG: Record<string, number> = {
  cinquinho: 5, dezinho: 10, dezao: 10, vintinho: 20, vintao: 20, trintinha: 30, cinquentinha: 50, cinquentao: 50,
  cemzinho: 100, cenzinho: 100, centao: 100, milzinho: 1000, milzao: 1000,
};
const SLANG_RE = new RegExp(String.raw`\b(${Object.keys(SLANG).join("|")})\b`, "g");

function wordsAmount(text: string): AmountMatch[] {
  const out: AmountMatch[] = [];
  const re = /\b((?:(?:um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|cento|duzentos|duzentas|trezentos|quatrocentos|quinhentos|seiscentos|setecentos|oitocentos|novecentos|mil)(?:\s+e\s+|\s+|$))+)(reais|real|contos?|pilas?)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const words = m[1].trim().split(/\s+/).filter((w) => w !== "e");
    if (!words.length) continue;
    // "um"/"uma" sozinho é artigo ("um lanche"), não valor — exceto com "reais".
    if (words.length === 1 && /^(um|uma|duas|dois)$/.test(words[0]) && !m[2]) continue;
    let total = 0;
    let chunk = 0;
    for (const w of words) {
      if (w === "mil") {
        total += (chunk || 1) * 1000;
        chunk = 0;
      } else chunk += UNITS[w] ?? 0;
    }
    total += chunk;
    if (total > 0) out.push({ cents: total * 100, start: m.index, end: m.index + m[0].length, raw: m[0].trim() });
  }
  return out;
}

export function findAmounts(text: string): AmountMatch[] {
  const out: AmountMatch[] = [];
  let m: RegExpExecArray | null;
  NUMERIC.lastIndex = 0;
  while ((m = NUMERIC.exec(text))) {
    const [full, currency, num, suffix] = m;
    const start = m.index;
    const end = start + full.length;
    // Número grudado em letra ("13o", "4g", "app99") não é valor.
    if (!suffix && /^[a-z]/.test(text.slice(end, end + 1))) continue;
    if (/[a-z]$/.test(text.slice(Math.max(0, start - 1), start))) continue;
    const before = text.slice(Math.max(0, start - 6), start);
    const after = text.slice(end, end + 16);
    if (/^\s*(x\b|vezes|parcelas|prestacoes)/.test(after) && !currency) continue; // parcelas
    if (/(dia|dias|em)\s*$/.test(before) && !currency && !suffix && /^\s*(x|vezes|\/|de\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez))/.test(after + " ")) continue;
    if (/dia\s*$/.test(before) && !currency && !suffix) continue; // "dia 5"
    if (/^\/\d/.test(after) || /\d\/$/.test(before)) continue; // datas 05/11
    if (/^\s*%/.test(after)) continue;
    if (/^\s*(h|hrs?|horas?|min)\b/.test(after)) continue;
    if (/^\s*(meses|mes|anos?|semanas?|dias)\b/.test(after) && !currency) continue;
    let value = toNumber(num);
    const s = (suffix ?? "").trim();
    if (s === "k") value *= 1000;
    if (s === "mil") {
      // "2 mil e 300"
      const rest = /^\s+e\s+(\d+)/.exec(after);
      value = value * 1000 + (rest ? Number(rest[1]) : 0);
    }
    if (!Number.isFinite(value) || value <= 0) continue;
    // Fala: "32 e 50" = R$ 32,50 (inteiro sem vírgula/sufixo + "e" + 2 dígitos que não são valor próprio).
    const cents = !s && /^\d+$/.test(num) ? /^\s+e\s+(\d{2})(?!\d|[,.]\d|\s*(?:x\b|vezes|reais|real|mil|k\b))/.exec(text.slice(end)) : null;
    if (cents) {
      const tail = cents[0].length;
      out.push({ cents: Math.round(value * 100) + Number(cents[1]), start, end: end + tail, raw: text.slice(start, end + tail).trim() });
      NUMERIC.lastIndex = end + tail;
      continue;
    }
    out.push({ cents: Math.round(value * 100), start, end, raw: full.trim() });
  }
  // "1,5k" já coberto; números por extenso.
  for (const w of wordsAmount(text)) if (!out.some((o) => w.start < o.end && o.start < w.end)) out.push(w);
  SLANG_RE.lastIndex = 0;
  while ((m = SLANG_RE.exec(text))) out.push({ cents: SLANG[m[1]] * 100, start: m.index, end: m.index + m[0].length, raw: m[0] });
  return out.sort((a, b) => a.start - b.start);
}

export function parseAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
  if (typeof value !== "string") return null;
  const found = findAmounts(value.toLowerCase());
  return found[0]?.cents ?? null;
}
