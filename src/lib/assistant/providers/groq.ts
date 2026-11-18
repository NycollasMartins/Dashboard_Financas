import "server-only";
import { buildUserPayload, SYSTEM_PROMPT } from "../prompt";
import { TRANSCRIBE_HINT } from "../media/prompts";
import { ProviderError, type AiInput, type AiParser, type AudioInput } from "./types";

/**
 * Groq (API compatível com OpenAI, modo JSON). Modelo padrão:
 * openai/gpt-oss-20b. Trocar por GROQ_MODEL. Chave em GROQ_API_KEY (servidor).
 */
export class GroqParser implements AiParser {
  readonly name = "groq" as const;
  /** responde em < 1 s; 5 s cobre fila. */
  readonly timeoutMs = 5000;
  readonly supportsImages = false;
  private readonly key = process.env.GROQ_API_KEY ?? "";
  private readonly model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  private readonly audioModel = process.env.GROQ_AUDIO_MODEL || "whisper-large-v3";

  available() {
    return Boolean(this.key);
  }

  async parse(input: AiInput, signal?: AbortSignal): Promise<unknown> {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.key}` },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        max_tokens: 800,
        // gpt-oss "pensa" antes de responder: no padrão gasta os 800 tokens pensando
        // (JSON vazio → 400) e estoura o limite grátis de 8.000 tokens/min. "low" ≈ 1/5.
        ...(/gpt-oss/.test(this.model) ? { reasoning_effort: "low" } : {}),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPayload(input.text, input.nowLocal, input.names) },
        ],
      }),
      signal,
    });
    if (!res.ok) throw new ProviderError(this.name, res.status, `Groq respondeu ${res.status}`);
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    try {
      return JSON.parse(body.choices?.[0]?.message?.content ?? "");
    } catch {
      throw new ProviderError(this.name, null, "Groq devolveu JSON inválido");
    }
  }

  /**
   * Transcrição com Whisper large-v3 (gratuito: 20/min, 2.000/dia, 2 h de áudio por hora).
   * Medido (18/11/2026, vozes sintéticas pt-BR): large-v3 92% × turbo 75% de transcrição correta no
   * essencial, mesmo tempo (~0,5 s) → large-v3 é o padrão.
   * Aceita ogg/opus (voz do Telegram), webm (Chrome) e mp4/m4a (Safari iOS).
   */
  async transcribe(audio: AudioInput, signal?: AbortSignal): Promise<string> {
    const form = new FormData();
    const bytes = Buffer.from(audio.base64, "base64");
    form.append("file", new Blob([bytes], { type: audio.mimeType.split(";")[0] }), audio.filename);
    form.append("model", this.audioModel);
    form.append("language", "pt");
    form.append("response_format", "json");
    form.append("temperature", "0");
    form.append("prompt", TRANSCRIBE_HINT);
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${this.key}` },
      body: form,
      signal,
    });
    if (!res.ok) throw new ProviderError(this.name, res.status, `Groq (áudio) respondeu ${res.status}`);
    const body = (await res.json()) as { text?: string };
    return (body.text ?? "").trim();
  }
}
