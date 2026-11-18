import "server-only";
import { buildUserPayload, SYSTEM_PROMPT } from "../prompt";
import { ProviderError, type AiInput, type AiParser } from "./types";

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
}
