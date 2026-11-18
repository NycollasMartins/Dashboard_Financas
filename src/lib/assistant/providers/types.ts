import type { NameContext } from "../types";

/*
 * Interface de provedor de IA (ADR-0005/0019). Trocar Gemini por Groq (ou
 * outro) não muda nada fora daqui. Já aceita imagens (multimodal) para a
 * leitura de prints da Fase 7 — por enquanto nenhuma tela envia imagem.
 */
export type AiInput = {
  text: string;
  /** "2026-11-17T14:32" no horário de São Paulo. */
  nowLocal: string;
  names: NameContext;
  images?: { mimeType: "image/png" | "image/jpeg" | "image/webp"; base64: string }[];
};

export interface AiParser {
  readonly name: "gemini" | "groq" | "mock";
  readonly supportsImages: boolean;
  /** Tempo máximo de espera (ms) antes de tentar o próximo provedor. */
  readonly timeoutMs?: number;
  /** true se a chave estiver configurada no servidor. */
  available(): boolean;
  /** Devolve o JSON CRU do modelo (o sistema valida com Zod). Lança em erro/timeout. */
  parse(input: AiInput, signal?: AbortSignal): Promise<unknown>;
}

export class ProviderError extends Error {
  constructor(public provider: string, public status: number | null, message: string) {
    super(message);
  }
}
