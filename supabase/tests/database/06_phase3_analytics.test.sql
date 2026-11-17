-- Fase 3: camada analítica (competência × caixa, realizado × previsto, posição,
-- vencimentos, agrupamentos) e isolamento entre famílias.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
select plan(42);

-- -----------------------------------------------------------------------------
-- Fixtures: família "Casa" (Alice dona + Bob membro) e família "Outra" (Carol).
-- Datas em 2025 → tudo já aconteceu, os testes não dependem do dia de hoje.
-- Cartão: fecha dia 3, vence dia 10.
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.dev', 'authenticated', 'authenticated', '{"full_name":"Alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.dev',   'authenticated', 'authenticated', '{"full_name":"Bob"}'),
  ('33333333-3333-3333-3333-333333333333', 'carol@test.dev', 'authenticated', 'authenticated', '{"full_name":"Carol"}');

set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';
select set_config('t.ws', public.create_household('Casa')::text, false);
select set_config('t.tok', public.create_workspace_invite(current_setting('t.ws')::uuid, 'bob@test.dev'), false);
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@test.dev"}';
select public.accept_workspace_invite(current_setting('t.tok'));

-- Bob lança o mercado (membro efetivo = Bob)
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';
insert into accounts (id, workspace_id, name, initial_balance_cents) values
  ('ac000000-0000-0000-0000-000000000001', current_setting('t.ws')::uuid, 'Conta', 100000);
insert into credit_cards (id, workspace_id, name, closing_day, due_day, limit_cents) values
  ('cc000000-0000-0000-0000-000000000001', current_setting('t.ws')::uuid, 'Nubank', 3, 10, 500000);
select set_config('t.mercado', (select id::text from categories where workspace_id = current_setting('t.ws')::uuid and name = 'Mercado'), false);
select set_config('t.compras', (select id::text from categories where workspace_id = current_setting('t.ws')::uuid and name = 'Compras'), false);
select set_config('t.salario', (select id::text from categories where workspace_id = current_setting('t.ws')::uuid and name = 'Salário'), false);
insert into categories (id, workspace_id, kind, name, parent_id) values
  ('ca000000-0000-0000-0000-000000000001', current_setting('t.ws')::uuid, 'expense', 'Feira', current_setting('t.mercado')::uuid);

insert into transactions (workspace_id, kind, amount_cents, description, occurred_on, category_id, payment_method, account_id, member_user_id)
values (current_setting('t.ws')::uuid, 'income', 500000, 'Salário', '2025-01-05', current_setting('t.salario')::uuid, 'transfer',
        'ac000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');
insert into transactions (workspace_id, kind, amount_cents, description, occurred_on, category_id, payment_method, account_id)
values (current_setting('t.ws')::uuid, 'expense', 3000, 'Feira', '2025-01-15', 'ca000000-0000-0000-0000-000000000001', 'pix',
        'ac000000-0000-0000-0000-000000000001');
-- Só previsto: aluguel não confirmado em fevereiro
insert into transactions (workspace_id, kind, amount_cents, description, occurred_on, payment_method, account_id, is_settled)
values (current_setting('t.ws')::uuid, 'expense', 200000, 'Aluguel', '2025-02-10', 'pix', 'ac000000-0000-0000-0000-000000000001', false);
-- Crédito 1x em 02/01 (antes do fechamento) → fatura que vence 10/01/2025
select public.create_card_purchase(current_setting('t.ws')::uuid, 'cc000000-0000-0000-0000-000000000001', 5000, 1,
                                   'Mercado no cartão', '2025-01-02', current_setting('t.mercado')::uuid);
-- 3x de R$ 100 em 20/11/2025: parcelas em nov, dez e jan (competência);
-- faturas que vencem 10/12/2025, 10/01/2026 e 10/02/2026 (caixa) → cruzam o ano.
select public.create_card_purchase(current_setting('t.ws')::uuid, 'cc000000-0000-0000-0000-000000000001', 30000, 3,
                                   'Cadeira', '2025-11-20', current_setting('t.compras')::uuid);

set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@test.dev"}';
insert into transactions (workspace_id, kind, amount_cents, description, occurred_on, category_id, payment_method, account_id)
values (current_setting('t.ws')::uuid, 'expense', 10000, 'Mercado', '2025-01-10', current_setting('t.mercado')::uuid, 'debit',
        'ac000000-0000-0000-0000-000000000001');

-- Pagamentos: jan/2025 e dez/2025 quitadas; jan/2026 paga PARCIALMENTE (40 de 100); fev/2026 em aberto.
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';
insert into invoice_payments (workspace_id, invoice_id, account_id, amount_cents, paid_on)
select current_setting('t.ws')::uuid, i.id, 'ac000000-0000-0000-0000-000000000001', v.amount, i.due_date
from (values ('2025-01-01'::date, 5000), ('2025-12-01'::date, 10000), ('2026-01-01'::date, 4000)) v(ref, amount)
join card_invoices i on i.card_id = 'cc000000-0000-0000-0000-000000000001' and i.reference_month = v.ref;

-- Família "Outra" da Carol, com um gasto em janeiro/2025
set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","email":"carol@test.dev"}';
select set_config('t.ws2', public.create_household('Outra')::text, false);
insert into transactions (workspace_id, kind, amount_cents, description, occurred_on, payment_method)
values (current_setting('t.ws2')::uuid, 'expense', 777700, 'Gasto da Carol', '2025-01-20', 'pix');

set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';

-- Regressão (bug da Fase 2): 1ª compra parcelada sem fatura existente no ciclo.
select is((select first_invoice_month from installment_plans where description = 'Cadeira'), '2025-12-01'::date,
  'compra parcelada cria a 1ª fatura e grava first_invoice_month');

-- -----------------------------------------------------------------------------
-- Totais do mês: competência × caixa
-- -----------------------------------------------------------------------------
select results_eq(
  $$ select income_cents, income_planned_cents, expense_cents, expense_planned_cents, entries
     from analytics_totals(current_setting('t.ws')::uuid, '2025-01-01', '2025-01-31', 'accrual') $$,
  $$ values (500000::bigint, 0::bigint, 18000::bigint, 0::bigint, 4) $$,
  'janeiro/2025 por competência: salário + mercado + feira + cartão');
select results_eq(
  $$ select expense_cents from analytics_totals(current_setting('t.ws')::uuid, '2025-01-01', '2025-01-31', 'cash') $$,
  $$ values (18000::bigint) $$,
  'janeiro/2025 por caixa: a fatura do cartão vence no próprio mês (10/01)');
select results_eq(
  $$ select expense_cents from analytics_totals(current_setting('t.ws')::uuid, '2025-11-01', '2025-11-30', 'accrual') $$,
  $$ values (10000::bigint) $$, 'novembro/2025 competência: 1ª parcela no mês da compra');
select results_eq(
  $$ select expense_cents + expense_planned_cents from analytics_totals(current_setting('t.ws')::uuid, '2025-11-01', '2025-11-30', 'cash') $$,
  $$ values (0::bigint) $$, 'novembro/2025 caixa: nada (a fatura só vence em dezembro)');
select results_eq(
  $$ select expense_cents from analytics_totals(current_setting('t.ws')::uuid, '2025-12-01', '2025-12-31', 'cash') $$,
  $$ values (10000::bigint) $$, 'dezembro/2025 caixa: fatura de 10/12 paga → realizado');

-- Parcelas cruzando o ano
select results_eq(
  $$ select expense_cents, expense_planned_cents from analytics_totals(current_setting('t.ws')::uuid, '2025-01-01', '2025-12-31', 'accrual') $$,
  $$ values (38000::bigint, 200000::bigint) $$, 'ano 2025 competência: 2 das 3 parcelas + aluguel previsto');
select results_eq(
  $$ select expense_cents, expense_planned_cents from analytics_totals(current_setting('t.ws')::uuid, '2025-01-01', '2025-12-31', 'cash') $$,
  $$ values (28000::bigint, 200000::bigint) $$, 'ano 2025 caixa: só 1 parcela vence em 2025');
select results_eq(
  $$ select expense_cents, expense_planned_cents from analytics_totals(current_setting('t.ws')::uuid, '2026-01-01', '2026-12-31', 'accrual') $$,
  $$ values (10000::bigint, 0::bigint) $$, 'ano 2026 competência: a 3ª parcela (janeiro)');
select results_eq(
  $$ select expense_cents, expense_planned_cents from analytics_totals(current_setting('t.ws')::uuid, '2026-01-01', '2026-12-31', 'cash') $$,
  $$ values (0::bigint, 20000::bigint) $$,
  'ano 2026 caixa: faturas de jan (paga parcialmente) e fev (aberta) contam como previstas');

-- As duas visões batem no acumulado de um período fechado
select results_eq(
  $$ select sum(expense_cents + expense_planned_cents), sum(income_cents + income_planned_cents)
     from analytics_totals(current_setting('t.ws')::uuid, '2025-01-01', '2026-12-31', 'accrual') $$,
  $$ select sum(expense_cents + expense_planned_cents), sum(income_cents + income_planned_cents)
     from analytics_totals(current_setting('t.ws')::uuid, '2025-01-01', '2026-12-31', 'cash') $$,
  'competência e caixa somam o mesmo no período fechado 2025–2026');
select results_eq(
  $$ select sum(expense_cents + expense_planned_cents)
     from analytics_monthly(current_setting('t.ws')::uuid, '2025-01-01', '2026-12-31', 'cash') $$,
  $$ values (248000::numeric) $$, 'soma mês a mês (caixa) = total do período');
select results_eq(
  $$ select sum(expense_cents + expense_planned_cents)
     from analytics_monthly(current_setting('t.ws')::uuid, '2025-01-01', '2026-12-31', 'accrual') $$,
  $$ values (248000::numeric) $$, 'soma mês a mês (competência) = total do período');

-- -----------------------------------------------------------------------------
-- Casos de borda
-- -----------------------------------------------------------------------------
select results_eq(
  $$ select income_cents, income_planned_cents, expense_cents, expense_planned_cents, entries
     from analytics_totals(current_setting('t.ws')::uuid, '2025-06-01', '2025-06-30', 'accrual') $$,
  $$ values (0::bigint, 0::bigint, 0::bigint, 0::bigint, 0) $$, 'mês sem lançamentos → zeros (uma linha)');
select results_eq(
  $$ select month, expense_cents from analytics_monthly(current_setting('t.ws')::uuid, '2025-05-01', '2025-07-31', 'accrual') $$,
  $$ values ('2025-05-01'::date, 0::bigint), ('2025-06-01'::date, 0::bigint), ('2025-07-01'::date, 0::bigint) $$,
  'evolução inclui meses vazios com zero');
select results_eq(
  $$ select expense_cents, expense_planned_cents from analytics_totals(current_setting('t.ws')::uuid, '2025-02-01', '2025-02-28', 'accrual') $$,
  $$ values (0::bigint, 200000::bigint) $$, 'mês só com previstos → realizado zero, previsto separado');
select results_eq(
  $$ select month, expense_cents from analytics_monthly(current_setting('t.ws')::uuid, '2025-11-15', '2026-01-10', 'accrual') $$,
  $$ values ('2025-11-01'::date, 10000::bigint), ('2025-12-01'::date, 10000::bigint), ('2026-01-01'::date, 10000::bigint) $$,
  'evolução usa meses inteiros mesmo com datas no meio do mês');
select is_empty(
  $$ select * from analytics_monthly(current_setting('t.ws')::uuid, '2025-03-01', '2025-01-01', 'accrual') $$,
  'intervalo invertido → vazio');
select throws_ok(
  $$ select * from analytics_totals(current_setting('t.ws')::uuid, '2025-01-01', '2025-01-31', 'foo') $$,
  '22P02', null, 'visão inválida é rejeitada');

-- -----------------------------------------------------------------------------
-- Filtros e agrupamentos
-- -----------------------------------------------------------------------------
select results_eq(
  $$ select category_id, parent_id, total_cents from analytics_by_category(current_setting('t.ws')::uuid, '2025-01-01', '2025-01-31', 'accrual')
     order by total_cents desc $$,
  $$ values (current_setting('t.mercado')::uuid, null::uuid, 15000::bigint),
            ('ca000000-0000-0000-0000-000000000001'::uuid, current_setting('t.mercado')::uuid, 3000::bigint) $$,
  'por categoria: subcategoria traz o pai em parent_id');
select results_eq(
  $$ select expense_cents from analytics_totals(current_setting('t.ws')::uuid, '2025-01-01', '2025-01-31', 'accrual',
                                                p_category_id => current_setting('t.mercado')::uuid) $$,
  $$ values (18000::bigint) $$, 'filtro de categoria inclui as subcategorias');
select results_eq(
  $$ select category_id, total_cents from analytics_by_category(current_setting('t.ws')::uuid, '2025-01-01', '2025-01-31', 'accrual', 'income') $$,
  $$ values (current_setting('t.salario')::uuid, 500000::bigint) $$, 'por categoria de receita');
select results_eq(
  $$ select member_id, income_cents, expense_cents from analytics_by_member(current_setting('t.ws')::uuid, '2025-01-01', '2025-01-31', 'accrual')
     order by expense_cents desc $$,
  $$ values ('22222222-2222-2222-2222-222222222222'::uuid, 0::bigint, 10000::bigint),
            ('11111111-1111-1111-1111-111111111111'::uuid, 500000::bigint, 8000::bigint) $$,
  'por membro: vários membros na família (membro efetivo = quem lançou)');
select results_eq(
  $$ select expense_cents from analytics_totals(current_setting('t.ws')::uuid, '2025-01-01', '2025-01-31', 'accrual',
                                                p_member_id => '22222222-2222-2222-2222-222222222222') $$,
  $$ values (10000::bigint) $$, 'filtro de membro');
select results_eq(
  $$ select source_type, expense_cents from analytics_by_source(current_setting('t.ws')::uuid, '2025-01-01', '2025-01-31', 'accrual')
     order by source_type $$,
  $$ values ('account', 13000::bigint), ('card', 5000::bigint) $$, 'por meio: conta × cartão');
select results_eq(
  $$ select expense_cents from analytics_totals(current_setting('t.ws')::uuid, '2025-01-01', '2026-12-31', 'cash',
                                                p_card_id => 'cc000000-0000-0000-0000-000000000001')
     union all
     select expense_planned_cents from analytics_totals(current_setting('t.ws')::uuid, '2025-01-01', '2026-12-31', 'cash',
                                                p_card_id => 'cc000000-0000-0000-0000-000000000001') $$,
  $$ values (15000::bigint), (20000::bigint) $$, 'filtro de cartão na visão caixa');
select results_eq(
  $$ select expense_cents + expense_planned_cents from analytics_totals(current_setting('t.ws')::uuid, '2025-01-01', '2026-12-31', 'accrual',
                                                p_account_id => 'ac000000-0000-0000-0000-000000000001') $$,
  $$ values (213000::bigint) $$, 'filtro de conta exclui compras no cartão');
select results_eq(
  $$ select description, amount_cents from analytics_entries(current_setting('t.ws')::uuid, '2025-01-01', '2025-12-31', 'accrual')
     where kind = 'expense' order by amount_cents desc, description limit 2 $$,
  $$ values ('Aluguel', 200000::bigint), ('Cadeira', 10000::bigint) $$, 'maiores gastos do período (empate desfeito pela descrição)');

-- -----------------------------------------------------------------------------
-- Posição: saldo, faturas (inclui pagamento parcial) e saldo projetado
-- -----------------------------------------------------------------------------
-- Saldo hoje = 100000 + 500000 − 10000 − 3000 − pagamentos (5000+10000+4000) = 568000
-- Faturas não quitadas: jan/2026 (restam 6000) + fev/2026 (10000) = 16000
-- Previsto: aluguel 200000 → projetado = 568000 − 200000 − 16000 = 352000
select results_eq(
  $$ select balance_cents, invoices_due_cents, planned_income_cents, planned_expense_cents, projected_balance_cents, is_projection
     from analytics_position(current_setting('t.ws')::uuid, private.today_sp()) $$,
  $$ values (568000::bigint, 16000::bigint, 0::bigint, 200000::bigint, 352000::bigint, true) $$,
  'saldo projetado = saldo + receitas previstas − despesas previstas − faturas a vencer (pagamento parcial abatido)');
select results_eq(
  $$ select open_invoices_cents, limit_cents, available_limit_cents from analytics_position(current_setting('t.ws')::uuid, private.today_sp()) $$,
  $$ values (16000::bigint, 500000::bigint, 484000::bigint) $$, 'faturas em aberto e limite disponível');
select results_eq(
  $$ select balance_cents, projected_balance_cents, is_projection from analytics_position(current_setting('t.ws')::uuid, '2025-01-31') $$,
  $$ values (582000::bigint, 582000::bigint, false) $$, 'período passado → saldo realizado no último dia, sem projeção');
select results_eq(
  $$ select balance_cents, invoices_due_cents from analytics_position(current_setting('t.ws')::uuid, private.today_sp(),
                                                                     p_card_id => 'cc000000-0000-0000-0000-000000000001') $$,
  $$ values (568000::bigint, 16000::bigint) $$, 'filtro de cartão mantém o saldo e as faturas daquele cartão');
select results_eq(
  $$ select item_type, amount_cents, is_overdue from analytics_upcoming(current_setting('t.ws')::uuid, 15) order by due_on $$,
  $$ values ('bill', 200000::bigint, true), ('invoice', 6000::bigint, true), ('invoice', 10000::bigint, true) $$,
  'próximos vencimentos: conta prevista + faturas não quitadas (vencidas sinalizadas)');

-- -----------------------------------------------------------------------------
-- Família com vários membros e isolamento (RLS)
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@test.dev"}';
select results_eq(
  $$ select expense_cents from analytics_totals(current_setting('t.ws')::uuid, '2025-01-01', '2025-12-31', 'accrual') $$,
  $$ values (38000::bigint) $$, 'Bob (membro) vê os mesmos totais da família que a Alice');

set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","email":"carol@test.dev"}';
select results_eq(
  $$ select income_cents + expense_cents + expense_planned_cents, entries
     from analytics_totals(current_setting('t.ws')::uuid, '2025-01-01', '2026-12-31', 'accrual') $$,
  $$ values (0::bigint, 0) $$, 'Carol (outra família) não vê os totais da Casa');
select is_empty($$ select * from analytics_by_category(current_setting('t.ws')::uuid, '2025-01-01', '2026-12-31') $$,
  'Carol não vê categorias da Casa');
select is_empty($$ select * from analytics_upcoming(current_setting('t.ws')::uuid, 90) $$,
  'Carol não vê vencimentos da Casa');
select results_eq(
  $$ select balance_cents, open_invoices_cents, limit_cents from analytics_position(current_setting('t.ws')::uuid, private.today_sp()) $$,
  $$ values (0::bigint, 0::bigint, 0::bigint) $$, 'Carol não vê saldo, faturas nem limite da Casa');
select results_eq(
  $$ select expense_cents from analytics_totals(current_setting('t.ws2')::uuid, '2025-01-01', '2025-01-31') $$,
  $$ values (777700::bigint) $$, 'Carol vê a própria família');

set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';
select results_eq(
  $$ select expense_cents from analytics_totals(current_setting('t.ws2')::uuid, '2025-01-01', '2025-01-31') $$,
  $$ values (0::bigint) $$, 'Alice não vê os gastos da família da Carol');

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.analytics_totals(current_setting('t.ws')::uuid, '2025-01-01', '2025-01-31') $$,
  '42501', null, 'anônimo não executa funções analíticas');
reset role;

-- Parcelas futuras de hoje em diante são "previstas" na competência
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@test.dev"}';
select set_config('t.wsb', (select id::text from workspaces where owner_id = '22222222-2222-2222-2222-222222222222' and kind = 'personal'), false);
insert into credit_cards (id, workspace_id, name, closing_day, due_day) values
  ('cc000000-0000-0000-0000-000000000002', current_setting('t.wsb')::uuid, 'Cartão Bob', 3, 10);
select public.create_card_purchase(current_setting('t.wsb')::uuid, 'cc000000-0000-0000-0000-000000000002', 20000, 2,
                                   'TV', private.today_sp());
select results_eq(
  $$ select expense_cents, expense_planned_cents from analytics_totals(current_setting('t.wsb')::uuid,
       private.today_sp(), private.today_sp() + 62, 'accrual') $$,
  $$ values (10000::bigint, 10000::bigint) $$, 'parcela de hoje é realizada; a do mês que vem é prevista');

select * from finish();
rollback;
