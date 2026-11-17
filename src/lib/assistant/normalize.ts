/*
 * Normalização do texto do usuário: minúsculas, sem acento, espaços simples,
 * erros de digitação comuns corrigidos. Puro e testado.
 */

const TYPOS: Record<string, string> = {
  gatei: "gastei", gastie: "gastei", gastey: "gastei", gstei: "gastei", gasteii: "gastei", gatsei: "gastei", gaste: "gastei", gstie: "gastei",
  paquei: "paguei", pagei: "paguei", pageui: "paguei", paguie: "paguei",
  resebi: "recebi", recebii: "recebi", reccebi: "recebi", recebe: "recebi", recbi: "recebi",
  guardie: "guardei", gardei: "guardei", guadei: "guardei", guaredi: "guardei",
  conprei: "comprei", comprie: "comprei", compei: "comprei",
  ganhe: "ganhei", ganhie: "ganhei", ganei: "ganhei",
  mercdo: "mercado", merado: "mercado", mercao: "mercado", mecado: "mercado", supermercdo: "supermercado",
  uver: "uber", ubr: "uber", ubber: "uber",
  ifod: "ifood", ifoof: "ifood", ifud: "ifood", aifood: "ifood",
  nubak: "nubank", nubnk: "nubank", nubanc: "nubank",
  farmasia: "farmacia", famacia: "farmacia",
  cartao: "cartao", catao: "cartao", crtao: "cartao",
  credto: "credito", creito: "credito",
  transferi: "transferi", tranferi: "transferi", transferii: "transferi",
  vc: "voce", q: "que", pq: "porque", tb: "tambem", hj: "hoje", ontm: "ontem",
};

export function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function normalize(text: string): string {
  const base = stripAccents(text)
    .toLowerCase()
    .replace(/[“”"`´']/g, "")
    .replace(/(\d)\s*,\s*(\d)/g, "$1,$2")
    .replace(/[!?;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base
    .split(" ")
    .map((w) => TYPOS[w] ?? w)
    .join(" ")
    .replace(/\bi food\b/g, "ifood")
    .replace(/\bnu bank\b/g, "nubank")
    .replace(/\bsuper mercado\b/g, "supermercado")
    // "99" é o app de transporte quando vem com "pop/taxi/pra/ate" e há outro valor na frase.
    .replace(/\b99 ?(pop|taxi)\b/g, "app99")
    .replace(/\b99 (?=(pra|para|ate|de volta|do|da)\b.*\d)/g, "app99 ");
}

/** Distância de edição (para nomes de metas/cartões digitados com erro). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** O texto menciona `name`? (palavra inteira; tolera 1 erro em nomes com 5+ letras). */
export function mentions(normText: string, name: string): boolean {
  const n = normalize(name);
  if (!n) return false;
  if (new RegExp(`(^|\\W)${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|\\W)`).test(normText)) return true;
  const words = normText.split(" ");
  const parts = n.split(" ");
  if (parts.length === 1 && n.length >= 5) return words.some((w) => Math.abs(w.length - n.length) <= 1 && levenshtein(w, n) <= 1);
  // Nome composto ("reserva de emergencia"): a palavra principal basta se for distintiva.
  return parts[0].length >= 5 && words.some((w) => levenshtein(w, parts[0]) <= 1);
}
