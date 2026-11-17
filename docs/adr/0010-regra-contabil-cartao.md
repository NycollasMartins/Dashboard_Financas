# ADR-0010 · Regra contábil do cartão e valores calculados

**Status:** Aceita · **Decisor:** Arquiteto + Analista · **Fase:** 2

## Decisão
1. **A compra no crédito É a despesa.** Ela entra no orçamento na **data da compra** (competência).
   Compra parcelada: cada parcela é um lançamento com competência = data da compra + (k−1) meses e
   fica na fatura k−1 meses após a fatura da compra.
2. **Pagar a fatura NÃO é despesa.** É uma movimentação de dinheiro da conta para o cartão
   (tabela `invoice_payments`): baixa o **saldo da conta** e o **limite usado** do cartão, mas não entra
   em "despesas do mês". Assim nada é contado duas vezes.
3. **Transferência entre contas** (`transfers`) também não é receita nem despesa.
4. **Nada derivado é armazenado**: status da fatura, total, pago, saldo de conta e limite disponível vêm de
   *views* (`card_invoice_summaries`, `account_balances`, `credit_card_summaries`) com `security_invoker`
   (respeitam a RLS). Removemos `status/paid_at/...` de `card_invoices`.

## Status da fatura (calculado)
`paid` (pagamentos ≥ total) → `overdue` (passou do vencimento com saldo) → `closed` (passou do fechamento)
→ `open`. Pagamento parcial é permitido; compra lançada depois numa fatura paga a reabre.

## Alternativas rejeitadas
- **Regime de caixa** (despesa no pagamento da fatura): o mês da compra ficaria "barato" e o da fatura
  "caro"; parcelas viraram um gasto único. Pode virar uma *visão* alternativa no dashboard (Fase 3).
- **Guardar saldo da conta**: risco de divergência com os lançamentos.
