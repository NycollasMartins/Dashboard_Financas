# ADR-0016 · Aporte em meta não é despesa

**Status:** Aceita · **Decisor:** Arquiteto + Analista · **Fase:** 4 · Complementa a ADR-0010

## Contexto
Guardar dinheiro para uma meta (viagem, carro, reserva) tira dinheiro "do disponível", mas não é um
gasto: o dinheiro continua seu. Se o aporte virasse despesa, "despesas do mês" ficaria inflado e a taxa
de economia cairia justamente quando você economiza. Se não aparecesse em lugar nenhum, o saldo das
contas mentiria.

## Decisão (explicada em português simples)
1. **Aporte = movimento de dinheiro entre lugares seus**, como uma transferência. Ele fica na tabela
   `goal_contributions` e:
   - **sai** da conta de origem escolhida (ex.: Conta Nubank) → o saldo disponível diminui;
   - **entra** na **conta de reserva** da meta, se houver (ex.: Poupança) → o patrimônio total não muda;
   - sem conta de reserva, fica na **"caixinha" da meta** (o valor guardado aparece na meta, fora das contas).
2. **Nunca entra em receitas nem em despesas.** O painel mostra **"Guardado em metas"** num KPI próprio.
3. **Retirada** = aporte negativo, com **motivo obrigatório**; devolve o dinheiro para a conta escolhida.
   Não pode passar do valor guardado (checado no banco).
4. **Taxa de economia** continua = (receitas − despesas) ÷ receitas. Como o aporte não é despesa, ele já
   está DENTRO dessa sobra; o painel mostra quanto dela foi para metas ("inclui R$ 500 em metas").
   Assim nada é contado duas vezes (teste pgTAP "nada sumiu nem foi contado duas vezes").
5. **Valor inicial já guardado** (`initial_cents`) conta no progresso da meta, mas **não** é um movimento:
   não aparece em "guardado no mês" nem mexe em saldos (o dinheiro já estava em algum lugar).
6. **Saldos calculados** (`account_balances`, saldo em data passada e saldo projetado) incluem os aportes
   **confirmados**; aportes **previstos** (aporte planejado) entram só na projeção.
7. **Aporte planejado** reaproveita `recurrences` (coluna `goal_id`): o mesmo gerador diário (pg_cron) cria
   **aportes previstos** em `goal_contributions`; a pessoa confirma com ✓ (ou marca "confirmar
   automaticamente"). Idempotente pelo mesmo índice único `(recurrence_id, recurrence_date)`.
8. **Status automático**: ao atingir o alvo, `active → achieved` (com `achieved_at`); uma retirada que deixe
   abaixo do alvo volta para `active`. `paused`/`archived` só mudam pela pessoa; meta arquivada não recebe aporte.

## Exemplo
Renda R$ 1.000, despesas R$ 300, aporte de R$ 200 da Conta para a Poupança (reserva do Carro):
despesas do mês = **R$ 300**; guardado no mês = **R$ 200**; taxa de economia = 70% (dos quais 20% em metas);
Conta −R$ 200, Poupança +R$ 200, patrimônio igual.

## Alternativas rejeitadas
- **Aporte como despesa (categoria "Investimentos")**: infla despesas e derruba a taxa de economia ao poupar.
- **Aporte como `transfers`**: exigiria uma conta de destino sempre (não suporta "caixinha") e misturaria
  transferências comuns com metas; perderíamos motivo/retirada/membro por meta.
- **Guardar o "saldo da meta"**: dado derivado que diverge; tudo é calculado (`goal_summaries`).
