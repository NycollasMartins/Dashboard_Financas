# ADR-0004 · Bot com canais desacoplados e service role restrita

**Status:** Aceita (implementação nas Fases 5–6) · **Decisor:** Arquiteto

## Decisão
```
Webhook (WhatsApp | Telegram)  →  ChannelAdapter  →  MessageService  →  AiParser (provedor trocável)
   valida assinatura               normaliza p/            regras, perguntas,      Gemini | Groq
   idempotência, rate limit        IncomingMessage         desfazer, consultas
                                                     ↓
                                         Repositório (Supabase, service role)
```
- `ChannelAdapter` (interface): `verify(request)`, `parse(request) → IncomingMessage[]`,
  `send(to, OutgoingMessage)`. Implementações: `WhatsAppCloudAdapter`, `TelegramAdapter`.
- `MessageService` não conhece o canal. Trocar/adicionar canal = novo adapter.
- O webhook roda no servidor com a **service role** (ignora RLS) porque não há sessão de usuário.
  Mitigações obrigatórias:
  1. Usuário resolvido **somente** via `channel_links` (vinculado por código de uso único).
  2. Todo acesso passa por um repositório que recebe `{ userId, workspaceId }` e **confere a participação**
     do usuário no espaço antes de ler/gravar; testes cobrem isso.
  3. Chave secreta só em variável de ambiente do servidor (`SUPABASE_SECRET_KEY`), arquivo com `import "server-only"`.
  4. Assinatura do webhook validada **antes** de qualquer processamento; `bot_messages` com id externo
     único garante idempotência (o WhatsApp reenvia webhooks).
  5. `hit_rate_limit()` no Postgres (sem Redis, custo zero).

## Alternativa considerada
Emitir um JWT do próprio usuário para o bot e usar RLS. Mais elegante, mas exige assinar tokens com a
chave do projeto (as chaves novas do Supabase são assimétricas e gerenciadas). Reavaliar na Fase 6.
