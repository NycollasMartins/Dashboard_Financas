# ADR-0017 · Motor de projeção a partir das regras

**Status:** Aceita · **Decisor:** Arquiteto + Back-end · **Fase:** 4 · Substitui a limitação citada na ADR-0015

## Contexto
O gerador de recorrências (ADR-0011) cria os lançamentos só **até o fim do mês atual**. Na Fase 3, o
painel de um mês futuro enxergava apenas parcelas já lançadas: o aluguel de março do ano que vem não
existia. Precisamos projetar até 36 meses **sem** gravar linhas no banco (que teriam de ser apagadas ao
editar uma recorrência).

## Decisão
1. `private.projected_occurrences(ws, de, até)` calcula **ocorrências virtuais** de cada recorrência
   **ativa**, usando a MESMA função de datas (`private.recurrence_dates`: dia 31 → último dia, semanal,
   anual, início/fim) — só para datas **depois** de `last_generated_on` (o que já foi gerado).
   Limite de segurança: até o dia 1º do 37º mês a partir de hoje (36 meses inteiros à frente).
2. `analytics_entries` ganhou `p_include_projected` (padrão `true`) e devolve essas linhas com
   `is_projected = true`, `is_planned = true` e `is_fixed = true`. Todas as funções do painel (totais,
   evolução, categorias, membros, meios) passam a enxergar o futuro sem mudar de assinatura.
3. Compras no cartão projetadas vão para o **vencimento da fatura** na visão caixa (`invoice_cycle`).
4. `analytics_position` (saldo projetado) soma receitas/despesas projetadas, faturas projetadas e os
   **aportes previstos** em metas (reais e projetados) que tiram dinheiro das contas consideradas.
5. **Garantia do mês atual**: o gerador já criou tudo até o fim do mês corrente, então não existe
   ocorrência virtual no mês atual → os números são **idênticos** aos da Fase 3 (teste pgTAP compara
   com `p_include_projected => false`).
6. Espelho em TS (`src/lib/domain/projection.ts`) com os mesmos casos de teste; a capacidade de poupança
   usa as despesas **fixas do próximo mês** vindas da projeção.
7. A lista de lançamentos de um mês futuro mostra as projeções como linhas **somente leitura**
   ("Projeção"), para que a lista some exatamente o que o painel mostra.

## Alternativas rejeitadas
- **Gerar linhas até 36 meses**: milhares de linhas previstas, e cada edição de recorrência teria de
  apagar e recriar o futuro (risco de inconsistência).
- **Projetar só no front**: duplicaria regras e não alimentaria as agregações do banco.

## Consequências
- Pausar ou encerrar uma recorrência some com as projeções na hora (nada para limpar).
- Projeções nunca aparecem como "realizado" e não podem ser editadas; viram lançamentos quando o mês chega.
