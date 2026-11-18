# ADR-0023 · Notificações: geração no banco (pg_cron), fila com retentativas e entrega por Web Push/Telegram

- **Status:** Aceita (18/11/2026)
- **Decisores:** Arquiteto, Backend, Mobile/UX

## Decisão
1. **Geração no banco** (`private.generate_notifications`, pg_cron a cada 15 min, a partir das 08:00 de SP) e por
   **trigger** (meta atingida; lançamento de outro membro — opcional, desligado por padrão). **Idempotência**:
   `notifications.unique(user_id, event_key)` → o mesmo evento nunca notifica duas vezes.
2. **Preferências** por usuário e tipo (`enabled`, `push`, `telegram`) + **horário de silêncio** (padrão 22h–7h).
   A central do app recebe tudo que estiver ligado; push/Telegram respeitam o silêncio.
3. **Fila** `notification_deliveries` (uma linha por canal). `claim_notification_deliveries` usa
   `FOR UPDATE SKIP LOCKED` (dois disparos nunca pegam a mesma entrega); `finish_notification_delivery` reagenda
   com espera crescente (1 min, 5 min, 30 min, 2 h) e após **5 falhas → dead-letter** (`ops_dead_letters`).
4. **Disparo**: o pg_cron chama `POST /api/notifications/dispatch` via **pg_net** com `x-cron-secret`
   (segredo no **Vault** do Supabase e em `CRON_SECRET` no app). Sem segredo configurado, só gera (central funciona).
5. **Web Push padrão (VAPID)** com `web-push`; chave privada só no servidor; `public/sw.js` mínimo (push + clique →
   deep link). 404/410 → apaga a assinatura. **iPhone**: só iOS 16.4+ com o app **na Tela de Início e aberto por ela**
   → a tela mostra o guia "Adicionar à Tela de Início" antes; a permissão só é pedida no toque em "Ativar".
6. **Telegram**: mesma notificação no chat vinculado, com botão "Abrir no Lar+" (deep link).

## Alternativas rejeitadas
- Cron no app (setInterval): some com reinícios/vários contêineres; o pg_cron já é usado (ADR-0011).
- Serviço pago de push (OneSignal etc.): custo/dados de terceiros sem necessidade.
