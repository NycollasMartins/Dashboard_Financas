# ADR-0019 · Privacidade, cota e cadeia de provedores do assistente

**Status:** Aceita · **Decisor:** Arquiteto + Back-end · **Fase:** 5

## Contexto (pesquisa em 17/11/2026 — confira os painéis antes de confiar nos números)
- **Gemini (Google AI Studio), plano gratuito**: limites por **projeto** (não por chave), mostrados só no painel.
  Leituras recentes: Flash/3.x Flash ~**20 pedidos/dia**; **3.1 Flash-Lite ~500/dia** e ~15/min. Modelo estável:
  `gemini-3.1-flash-lite`. **No gratuito, o Google usa o que você envia para melhorar produtos e pessoas podem
  revisar** (os termos pedem para não enviar dados sensíveis).
- **Groq, plano gratuito** (sem cartão, por organização): ~30 pedidos/min; por dia varia por modelo
  (de ~1.000 a 14.400). Modelo padrão aqui: `openai/gpt-oss-20b` (modo JSON).

## Decisão
1. **O que vai para o provedor (e nada mais)**: o **texto da mensagem** (até 500 caracteres), a **data/hora
   atual** e os **NOMES** de categorias, contas, cartões e metas do espaço. **Nunca**: saldos, valores do
   histórico, e-mails, nomes de pessoas, ids. Montado em um único lugar (`prompt.ts#buildUserPayload`).
2. **Cadeia**: parser local → Gemini (`GEMINI_MODEL`, padrão flash-lite) → Groq (`GROQ_MODEL`) → parser local.
   Provedor sem chave é pulado; erro/timeout (8 s)/429/JSON inválido → próximo.
3. **Cota** (`assistant_take_quota`, atômica no banco): por **usuário/dia/provedor** (`ASSISTANT_AI_DAILY_LIMIT`,
   padrão 40) e **rate limit por minuto** (`ASSISTANT_AI_PER_MINUTE`, padrão 8). Sem cota → próximo provedor →
   parser local. O parser local não consome cota.
4. **Chaves só no servidor** (`GEMINI_API_KEY`, `GROQ_API_KEY` em `.env.local`/EasyPanel), em arquivos com
   `import "server-only"`. `ASSISTANT_AI_ENABLED=false` desliga a IA (tudo local).
5. **Aviso de privacidade** curto na tela do assistente + seção no README.
6. **Imagens**: a interface `AiParser` já aceita imagens (Gemini é multimodal), mas nenhuma tela envia nesta
   fase — leitura de prints é Fase 7.

## Consequências
- Funciona offline e sem chave (só o parser local).
- Trocar de modelo/provedor = variável de ambiente ou nova classe que implementa `AiParser`.
- Se os limites gratuitos mudarem, o app degrada para o parser local em vez de quebrar.
