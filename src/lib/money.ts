/**
 * Dinheiro é SEMPRE um inteiro em centavos. Nunca use float para valores.
 * Ex.: R$ 1.234,56 → 123456
 */
export type Cents = number;

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function assertCents(value: number): asserts value is Cents {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`Valor monetário inválido (precisa ser inteiro em centavos): ${value}`);
  }
}

/** 123456 → "R$ 1.234,56" (com espaço não separável, como o Intl gera). */
export function formatBRL(cents: Cents, opts: { compact?: boolean; signed?: boolean } = {}): string {
  assertCents(cents);
  const value = cents / 100;
  const text = (opts.compact ? brlCompact : brl).format(Math.abs(value));
  if (cents < 0) return `-${text}`;
  if (opts.signed && cents > 0) return `+${text}`;
  return text;
}

/**
 * Converte texto digitado pelo usuário em centavos, SEM passar por float.
 * Aceita: "50", "50,9", "50,90", "1.234,56", "R$ 1.234,56", "1234.56", "-10".
 * Retorna null se não for um valor válido.
 */
export function parseBRL(input: string): Cents | null {
  if (typeof input !== "string") return null;
  let s = input.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!s) return null;

  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }

  let intPart: string;
  let fracPart = "";

  if (s.includes(",")) {
    // Formato brasileiro: vírgula decimal, ponto como milhar.
    const [i, f, ...rest] = s.split(",");
    if (rest.length) return null;
    if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(i)) return null;
    intPart = i.replace(/\./g, "");
    fracPart = f;
  } else if (/^\d+\.\d{1,2}$/.test(s)) {
    // "1234.56" → ponto decimal (comum em CSV/OFX).
    [intPart, fracPart] = s.split(".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.234" → milhar
    intPart = s.replace(/\./g, "");
  } else if (/^\d+$/.test(s)) {
    intPart = s;
  } else {
    return null;
  }

  if (!/^\d*$/.test(fracPart) || fracPart.length > 2) return null;
  const cents = Number(intPart) * 100 + Number(fracPart.padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

/** Soma segura de centavos. */
export function sumCents(values: readonly Cents[]): Cents {
  return values.reduce((acc, v) => {
    assertCents(v);
    return acc + v;
  }, 0);
}

/**
 * Divide um total em N parcelas inteiras; o resto vai para a PRIMEIRA parcela.
 * Ex.: 10000 em 3 → [3334, 3333, 3333]. A soma sempre bate com o total.
 */
export function splitInstallments(total: Cents, count: number): Cents[] {
  assertCents(total);
  if (!Number.isInteger(count) || count < 1) throw new RangeError("Número de parcelas inválido");
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => (i === 0 ? base + remainder : base));
}
