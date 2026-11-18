import "server-only";
import { buildUserPayload, SYSTEM_PROMPT } from "../prompt";
import { ProviderError, type AiInput, type AiParser } from "./types";

/**
 * Google Gemini (REST generateContent, saída JSON). Modelo padrão:
 * gemini-3.1-flash-lite (cota gratuita maior que o Flash). Trocar por
 * GEMINI_MODEL. A chave fica só no servidor (GEMINI_API_KEY).
 */
export class GeminiParser implements AiParser {
  readonly name = "gemini" as const;
  /** mediana medida 3,1 s; p95 13 s no gratuito → corta e passa ao Groq. */
  readonly timeoutMs = 6000;
  readonly supportsImages = true;
  private readonly key = process.env.GEMINI_API_KEY ?? "";
  private readonly model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

  available() {
    return Boolean(this.key);
  }

  async parse(input: AiInput, signal?: AbortSignal): Promise<unknown> {
    const parts: object[] = [{ text: buildUserPayload(input.text, input.nowLocal, input.names) }];
    for (const img of input.images ?? []) parts.push({ inline_data: { mime_type: img.mimeType, data: img.base64 } });
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": this.key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 800 },
      }),
      signal,
    });
    if (!res.ok) throw new ProviderError(this.name, res.status, `Gemini respondeu ${res.status}`);
    const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    try {
      return JSON.parse(text);
    } catch {
      throw new ProviderError(this.name, null, "Gemini devolveu JSON inválido");
    }
  }
}
