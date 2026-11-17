# ADR-0009 · Trilha de auditoria em vez de soft delete

**Status:** Aceita · **Decisor:** Arquiteto · **Fase:** 2

## Contexto
Precisamos saber quem criou/alterou/excluiu lançamentos e poder **desfazer** uma exclusão.

## Opções
1. **Soft delete** (`deleted_at` em cada tabela): toda consulta, soma, view e política precisaria lembrar
   de filtrar `deleted_at is null`. Um esquecimento = saldo errado. Índices únicos (recorrência/mês,
   parcela, dedupe) também passariam a considerar linhas "mortas".
2. **Auditoria + exclusão real** ✅: uma tabela `audit_log` preenchida por trigger (`INSERT/UPDATE/DELETE`)
   com `actor_id`, `at`, `old_data`, `new_data` (jsonb). A tabela de negócio só tem linhas vivas.

## Decisão
Opção 2.
- Tabelas auditadas: `transactions`, `transfers`, `invoice_payments`, `recurrences`, `credit_cards`,
  `accounts`, `categories`, `installment_plans`.
- `audit_log` legível por membros do espaço (RLS), sem escrita pelo cliente.
- `transactions.updated_by` (trigger) + `created_by` (forçado) dão "quem/quando" sem consultar o log.
- **Desfazer**: `restore_deleted_transaction(id)` reinsere a partir do `old_data` (até 24 h, por quem
  excluiu ou admin), **mantendo o autor original**.
- Durante a exclusão de um espaço inteiro (cascata) não se registra nada (evita lixo de dados apagados).

## Consequências
- ✅ Somas e views simples e corretas por construção.
- ⚠️ O log cresce; na Fase 8 adicionar retenção (ex.: 12 meses) via pg_cron.
