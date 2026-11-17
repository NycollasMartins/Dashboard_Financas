import { formatBRL } from "@/lib/money";

/** Passo "redondo" (1, 2, 2,5, 5 × 10ⁿ) para ~`count` divisões do eixo. */
export function niceTicks(min: number, max: number, count = 3): number[] {
  if (max <= min) return [0];
  const raw = (max - min) / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) ticks.push(Math.round(v));
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/** Valor curto para eixos: "R$ 12 mil". */
export function axisBRL(cents: number) {
  return formatBRL(Math.round(cents / 100) * 100, { compact: true });
}
