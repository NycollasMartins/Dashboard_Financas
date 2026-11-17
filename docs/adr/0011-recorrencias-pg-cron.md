# ADR-0011 · Recorrências geradas no banco (pg_cron) e de forma idempotente

**Status:** Aceita · **Decisor:** Arquiteto · **Fase:** 2

## Decisão
- Frequências: **semanal** (mesmo dia da semana de `starts_on`), **mensal** (dia 29–31 → último dia),
  **anual** (mesmo mês de `starts_on`).
- Geração em SQL (`private.generate_recurrence`) até o **fim do mês corrente** (horizonte):
  1. na hora em que a recorrência é criada (trigger);
  2. diariamente às 03:00 de São Paulo via **pg_cron** (gratuito no Supabase, ao contrário do cron da
     Vercel Hobby, limitado);
  3. ao reativar uma recorrência pausada.
- **Idempotência dupla**: marcador `last_generated_on` + índice único `(recurrence_id, recurrence_date)`.
  Rodar duas vezes nunca duplica; uma ocorrência excluída pelo usuário não "renasce".
- Lançamentos gerados entram como **previstos** (`is_settled = false`) ou **confirmados** (`auto_confirm`,
  útil para assinaturas no cartão).
- **Editar "daqui pra frente"** (`apply_recurrence_to_future`): apaga só os previstos a partir de hoje e
  gera de novo com os novos dados. Confirmados e passados nunca mudam.
- Uma recorrência com erro (ex.: membro que saiu) não impede as outras (exceção isolada no job).
