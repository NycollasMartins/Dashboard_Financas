import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Compara segredos em tempo constante (não vaza o tamanho do acerto). */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
