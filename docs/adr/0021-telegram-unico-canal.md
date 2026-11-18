# ADR-0021 · Telegram como único canal de mensagens (WhatsApp fora por custo) e como o bot age em nome do usuário

- **Status:** Aceita (18/11/2026) — revisa a ADR-0004 (canais) na parte do WhatsApp
- **Decisores:** dono do produto, Arquiteto, Segurança

## Contexto
Desde 01/10/2026 a Meta cobra respostas do WhatsApp Business acima de 1.000/mês. O Telegram Bot API é gratuito,
tem webhook com `secret_token`, teclados inline e aceita fotos e voz. Requisito do projeto: **custo zero**.

## Decisão
1. **Somente Telegram** (@LarMaisBot, configurável). A arquitetura de *adapters* fica: o adapter só traduz
   update ↔ `handleAssistant` (motor da Fase 5, ADR-0018). Outro canal no futuro = outro adapter.
2. **Webhook**: header `X-Telegram-Bot-Api-Secret-Token` comparado em tempo constante; idempotência por
   `update_id` (`telegram_updates`, PK); responde 200 na hora e processa com `after()`; anti-flood
   (20 msgs/min por chat); limite de 1 MB no corpo. Sem conteúdo de mensagem em tabela ou log.
3. **Vinculação**: código de uso único (10 min, só o hash é salvo) gerado em *Configurações → Canais* +
   QR + deep link `t.me/LarMaisBot?start=CÓDIGO`. **Um chat por usuário** (vincular outro chat substitui).
   Chat não vinculado recebe só a instrução, nenhum dado.
4. **Como o bot grava como a pessoa (sem burlar a RLS):** o servidor abre uma **sessão normal do usuário dono do
   chat** — `auth.admin.generateLink(magiclink)` (não envia e-mail) → `verifyOtp(token_hash)` → access token
   (~1 h) em **memória**. Todas as gravações usam esse cliente: RLS, `created_by = auth.uid()`, triggers e
   auditoria valem igual ao app. A *secret key* só é usada para achar o vínculo pelo `chat_id`, idempotência e
   anti-flood — nunca para dados financeiros.
5. **Só chat privado.** Em grupo o bot veria mensagens de pessoas não vinculadas e responderia dados financeiros
   para todos do grupo. Avaliar "grupo da família" no futuro (exigiria vínculo por membro e respostas sem valores).
6. Espaço: `channel_links.default_workspace_id`; "usar família"/"usar individual" e `/espaco`; toda gravação
   informa o espaço. Comandos: `/start /ajuda /resumo /desfazer /espaco /desvincular`.
7. Botões: `callback_data` ≤ 64 bytes (`c:/x:/e:/o:/u:/w:` + uuid); a resposta **edita** a mensagem dos botões.
8. Falha no processamento → aviso à pessoa + `failed`/`dead` em `ops_dead_letters`. Sem reprocessamento
   automático (o conteúdo não é guardado). Envios ao Telegram têm retentativa (429 com `retry_after`, 5xx).

## Alternativas rejeitadas
- **Secret key + checar membro manualmente** (ADR-0004 original): duplicaria regras de permissão no código e
  perderia `auth.uid()` nos triggers.
- **JWT assinado pelo app**: exigiria o segredo JWT do projeto (chaves assimétricas no Supabase novo).
- **Polling (getUpdates)**: precisaria de processo sempre rodando e não escala melhor que o webhook.
