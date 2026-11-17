import type { AiInput, AiParser } from "./types";

/**
 * Provedor de TESTE (CI): devolve respostas ESCRITAS À MÃO no formato que a IA
 * deve produzir (não são gravações de um provedor real). Serve para testar o
 * pipeline — validação, normalização, fallback — sem rede e sem chave.
 */
export class MockParser implements AiParser {
  readonly name = "mock" as const;
  readonly supportsImages = false;
  calls: string[] = [];
  constructor(private responses: Record<string, unknown | Error>, private enabled = true) {}
  available() {
    return this.enabled;
  }
  async parse(input: AiInput): Promise<unknown> {
    this.calls.push(input.text);
    const r = this.responses[input.text];
    if (r instanceof Error) throw r;
    if (r === undefined) throw new Error("sem resposta simulada");
    return r;
  }
}
