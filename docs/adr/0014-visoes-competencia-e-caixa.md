# ADR-0014 · Duas visões de período: competência (padrão) e caixa

**Status:** Aceita · **Decisor:** Arquiteto + Analista · **Fase:** 3 · Complementa a ADR-0010

## Contexto
A ADR-0010 fixou que **a compra no crédito é a despesa** (competência). Mas quem paga a fatura sente o
gasto no mês do **vencimento**: "em dezembro saiu R$ 4.000 da minha conta" é uma pergunta legítima.
Precisamos responder às duas perguntas sem duplicar dados nem contar nada duas vezes.

## Decisão
1. O painel tem um seletor **Competência | Caixa** (`?visao=caixa` na URL; padrão = competência).
2. **Competência**: cada lançamento conta na sua data (`occurred_on`): compra, parcela (data da compra +
   k−1 meses) ou recebimento.
3. **Caixa / por vencimento**: compra no cartão conta no **vencimento da fatura** em que caiu; os demais
   lançamentos (pix, débito, dinheiro, boleto, receitas) contam na data em que saem/entram na conta.
4. **Pagamento de fatura continua NÃO sendo despesa** nas duas visões. Na visão caixa, o que entra no mês
   são as **compras** da fatura que vence nele (com categoria), e não o pagamento (que não tem categoria).
   Assim o gráfico por categoria funciona igual nas duas visões.
5. **Realizado × previsto** (RN-62): na competência, previsto = não confirmado ou data futura. Na caixa, a
   compra no cartão é prevista até a fatura estar **quitada**; pagamento parcial mantém a fatura toda como
   prevista (o restante aparece em "faturas a vencer").
6. A regra mora em SQL (`public.analytics_entries`) e em TS (`src/lib/domain/basis.ts`) com os mesmos casos.
7. **Invariante testada**: num período que contém todas as datas envolvidas (compras **e** vencimentos), as
   duas visões somam exatamente o mesmo — o dinheiro só muda de mês, nunca aparece ou some.

## Exemplo (seed: cartão Nubank fecha dia 3 e vence dia 10)
Notebook de R$ 4.999,90 em 10x comprado no dia 14: cada parcela de R$ 499,99 conta **dia 14 de cada mês**
na competência e **dia 10 do mês seguinte** na caixa. O total das 10 parcelas é igual nas duas visões.

## Alternativas rejeitadas
- **Só competência**: não responde "quanto saiu da conta neste mês".
- **Caixa pelo pagamento da fatura**: o pagamento não tem categoria (gráfico por categoria quebraria) e
  pagamento parcial distorceria os meses. Usar o vencimento das compras resolve os dois.
- **Guardar a "data de caixa" em cada lançamento**: dado derivado armazenado (contra a ADR-0010) que
  teria de ser atualizado quando a fatura muda.

## Consequências
- A lista de lançamentos continua por data da compra; o painel avisa a visão em uso em cada gráfico.
- Mudou um ciclo de fatura? As duas visões se ajustam sozinhas (tudo é calculado).
