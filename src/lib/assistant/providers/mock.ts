import type { AiInput, AiParser, AudioInput, ImageInput } from "./types";

/**
 * Provedor de TESTE (CI): devolve respostas ESCRITAS À MÃO no formato que a IA
 * deve produzir (não são gravações de um provedor real). Serve para testar o
 * pipeline — validação, normalização, fallback — sem rede e sem chave.
 * Foto/áudio: a chave é o início do base64 (ex.: "RECIBO1…") → resposta.
 */
export class MockParser implements AiParser {
  readonly name = "mock" as const;
  readonly supportsImages = true;
  calls: string[] = [];
  constructor(
    private responses: Record<string, unknown | Error>,
    private enabled = true,
    private media: { receipts?: Record<string, unknown | Error>; transcripts?: Record<string, string | Error> } = {},
  ) {}
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
  async extractReceipt(input: ImageInput): Promise<unknown> {
    const key = Object.keys(this.media.receipts ?? {}).find((k) => input.image.base64.startsWith(k));
    this.calls.push(`[imagem ${key ?? "?"}]`);
    const r = key ? this.media.receipts![key] : undefined;
    if (r instanceof Error) throw r;
    if (r === undefined) throw new Error("sem imagem simulada");
    return r;
  }
  async transcribe(audio: AudioInput): Promise<string> {
    const key = Object.keys(this.media.transcripts ?? {}).find((k) => audio.base64.startsWith(k));
    this.calls.push(`[áudio ${key ?? "?"}]`);
    const r = key ? this.media.transcripts![key] : undefined;
    if (r instanceof Error) throw r;
    if (r === undefined) throw new Error("sem áudio simulado");
    return r;
  }
}
