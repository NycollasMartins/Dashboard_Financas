# ADR-0015 · Camada analítica no banco e gráficos sem biblioteca

**Status:** Aceita · **Decisor:** Arquiteto + Back-end + Designer · **Fase:** 3

## Contexto
O painel precisa de ~10 agregações por tela (totais, série de 12 meses, categorias, membros, posição,
vencimentos…), rápido no celular e **sem vazar dados entre famílias**. A Fase 2 calculava os totais no
front (somando linhas), o que não escala.

## Decisão
1. **Agregação no Postgres**, em funções `public.analytics_*` com `LANGUAGE sql STABLE SECURITY INVOKER
   SET search_path = ''`:
   - `SECURITY INVOKER` → a RLS de `transactions`, `card_invoices` etc. vale dentro da função. Nenhuma
     checagem manual de workspace a esquecer; testado com uma 2ª família no pgTAP (RN-69).
   - Uma função-base (`analytics_entries`) aplica visão + filtros; as outras agregam em cima dela.
   - Só `authenticated`/`service_role` executam (anônimo recebe `42501`).
2. **Índices** escolhidos pelos planos (`EXPLAIN ANALYZE`) com 200 mil lançamentos em 100 espaços:

   | Consulta | Antes dos índices | Depois |
   |---|---|---|
   | `analytics_totals` (mês) | 21 ms | 7 ms |
   | `analytics_monthly` (12 meses, caixa) | 5 ms | 5 ms |
   | `analytics_by_category` | 1 ms | 1 ms |
   | `analytics_position` (saldo projetado) | **97 ms** (varredura completa por conta) | **8 ms** |
   | `analytics_upcoming` | 1 ms | 1 ms |

   Competência usa `transactions_ws_date_idx`; caixa usa `card_invoices_ws_due_idx` +
   `transactions_invoice_idx`. Um índice "covering" testado não foi usado pelo planner e foi descartado.
3. **No servidor (Next)**: cada bloco do painel é um Server Component com seu `<Suspense>` (o topo aparece
   primeiro); as RPCs repetidas entre blocos são deduplicadas com `cache()` do React (chave JSON).
4. **Regras de apresentação puras e testadas em TS** (`src/lib/analytics/*`): período, variação e tom
   semântico, árvore de categorias, insights por regra. Nada disso precisa do banco para ser testado.
5. **Gráficos sem biblioteca** (HTML + CSS + um `<svg>` para a linha), em vez de Recharts:
   - ~0 KB de JS a mais para os gráficos de barras/medidores (são Server Components); só o gráfico de
     evolução é client (tooltip/teclado), poucos KB.
   - Renderizam no servidor (sem "pulo" de layout, CLS 0) e respeitam `prefers-reduced-motion`.
   - Cada gráfico tem **alternância para tabela** (acessibilidade, daltonismo, leitor de tela).
   - Paleta das séries (`--viz-income/expense/balance`) **validada por script** para daltonismo
     (protan/deutan ΔE ≥ 9,9) e contraste ≥ 3:1 nos dois temas.
6. **Ocultar valores**: `profiles.hide_amounts` + atributo `data-privacy` no app; o CSS troca todo
   `<Money>` por "R$ ••••" (o valor real sai da árvore de acessibilidade).

## Alternativas rejeitadas
- **Views materializadas**: dados "atrasados" e refresh a gerenciar; desnecessário no volume medido.
- **Agregar no front**: baixa centenas de linhas no celular e repete regra de negócio.
- **Recharts/Chart.js**: +60–100 KB de JS no celular para gráficos que o HTML/CSS resolve.
- **Uma RPC gigante que devolve tudo em JSON**: difícil de testar; perde o streaming por bloco.

## Consequências
- Se o volume crescer muito (centenas de milhares de lançamentos por espaço), avaliar tabelas de resumo
  mensais mantidas por trigger — a interface das funções não muda.
