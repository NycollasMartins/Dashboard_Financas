import "server-only";
import { GeminiParser } from "../providers/gemini";
import { GroqParser } from "../providers/groq";
import type { AiParser } from "../providers/types";

/*
 * Configuração do assistente (variáveis de ambiente, só servidor).
 * Ordem dos provedores: Gemini → Groq → parser local (sempre disponível).
 */
const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

export const assistantConfig = {
  /** Acima deste valor (centavos) o assistente sempre pede confirmação. */
  confirmAboveCents: num(process.env.ASSISTANT_CONFIRM_ABOVE_CENTS, 100_000),
  /** Chamadas de IA por usuário, por dia e por provedor. */
  dailyLimit: num(process.env.ASSISTANT_AI_DAILY_LIMIT, 40),
  /** Rate limit por usuário (todas as mensagens que chegam à IA) por minuto. */
  perMinute: num(process.env.ASSISTANT_AI_PER_MINUTE, 8),
  aiEnabled: process.env.ASSISTANT_AI_ENABLED !== "false",
};

export function defaultProviders(): AiParser[] {
  if (!assistantConfig.aiEnabled) return [];
  return [new GeminiParser(), new GroqParser()];
}
