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
  /** Fase 6 — fotos e áudios por usuário/dia (cotas próprias). */
  photoDailyLimit: num(process.env.ASSISTANT_PHOTO_DAILY_LIMIT, 15),
  audioDailyLimit: num(process.env.ASSISTANT_AUDIO_DAILY_LIMIT, 30),
  /** Limites de arquivo (recusados antes de chamar a IA). */
  maxImageBytes: num(process.env.ASSISTANT_MAX_IMAGE_BYTES, 4_000_000),
  maxAudioBytes: num(process.env.ASSISTANT_MAX_AUDIO_BYTES, 2_500_000),
  maxAudioSeconds: num(process.env.ASSISTANT_MAX_AUDIO_SECONDS, 60),
};

export function defaultProviders(): AiParser[] {
  if (!assistantConfig.aiEnabled) return [];
  return [new GeminiParser(), new GroqParser()];
}
