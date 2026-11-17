# ADR-0005 · Provedor de IA: Gemini (primário) + Groq (alternativa), atrás de interface

**Status:** Aceita e **revisada na Fase 5** pelas ADR-0018 (a IA só interpreta) e ADR-0019 (privacidade, cota, modelos) · **Decisor:** Arquiteto

## Contexto (pesquisa em 17/11/2026)
- **Google Gemini API (AI Studio)**: tem plano gratuito, mas os limites mudaram várias vezes em 2026
  (fontes divergem: de ~20–50 até ~1.500 requisições/dia nos modelos *Flash*; modelos *Pro* praticamente
  fora do gratuito). O Google não publica mais uma tabela fixa: os limites aparecem no AI Studio, por projeto.
  Diferencial: **multimodal** (lê imagens → útil para prints de notificação, RF-57).
  ⚠️ No plano gratuito, o Google pode usar os dados enviados para melhorar produtos.
- **Groq**: plano gratuito sem cartão, limites por modelo e por organização (fontes citam ~30 req/min
  e de 1.000 a 14.400 req/dia, dependendo do modelo). Muito rápido; modelos abertos (Llama etc.).

Uso estimado deste app: dezenas de mensagens/dia → cabe com folga em qualquer um dos dois.

## Decisão
- Interface `AiParser` com `parseMessage(text, context) → ParsedIntent` (validado com Zod).
- **Primário: Gemini Flash/Flash-Lite** (texto + imagem). **Fallback: Groq** quando o Gemini responder 429/erro.
- Prompt com **saída estruturada** (JSON schema) e validação Zod; se a validação falhar → perguntar ao usuário.
- Regras determinísticas antes da IA (regex para "gastei 50 no uber" simples, comando "desfazer") para
  economizar cota e reduzir latência.
- Não enviar dados além do necessário (sem nomes completos de terceiros nem saldos detalhados no prompt).

## Consequências
- Trocar provedor = nova classe que implementa `AiParser` + variável de ambiente.
- Limites gratuitos podem mudar: monitorar 429 nos logs.
