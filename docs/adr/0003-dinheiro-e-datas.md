# ADR-0003 · Dinheiro em centavos e datas em America/Sao_Paulo

**Status:** Aceita · **Decisor:** Arquiteto

## Decisão
- Valores sempre em **centavos inteiros**: `bigint` no banco, `number` inteiro seguro no TypeScript
  (`Number.isSafeInteger`, até ~R$ 90 trilhões). Nunca `float`/`numeric` para valores.
- Conversão texto → centavos em `src/lib/money.ts` (`parseBRL`) **sem passar por float**.
- Parcelas: resto dos centavos na 1ª parcela (`splitInstallments`), garantindo soma exata.
- Datas de competência como `date` (`YYYY-MM-DD`); instantes como `timestamptz`.
- "Hoje"/"mês atual" sempre calculados em **America/Sao_Paulo** (`src/lib/dates.ts`), nunca em UTC.

## Por quê
`0.1 + 0.2 = 0.30000000000000004` em float. Em finanças isso vira centavos sumindo em somas e parcelas.
Um gasto às 23h de 31/10 em São Paulo já é 01/11 em UTC — cairia no mês errado.
