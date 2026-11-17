-- Fase 4: metas, aportes/retiradas, regra contábil (nada contado duas vezes),
-- aporte planejado via recorrência, motor de projeção e isolamento (RLS).
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
select plan(42);

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.dev', 'authenticated', 'authenticated', '{"full_name":"Alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.dev',   'authenticated', 'authenticated', '{"full_name":"Bob"}'),
  ('33333333-3333-3333-3333-333333333333', 'carol@test.dev', 'authenticated', 'authenticated', '{"full_name":"Carol"}');

set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';
select set_config('t.ws', public.create_household('Casa')::text, false);
select set_config('t.tok', public.create_workspace_invite(current_setting('t.ws')::uuid, 'bob@test.dev'), false);
select set_config('t.wsa', (select id::text from workspaces where owner_id = '11111111-1111-1111-1111-111111111111' and kind = 'personal'), false);
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@test.dev"}';
select public.accept_workspace_invite(current_setting('t.tok'));
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';

insert into accounts (id, workspace_id, name, initial_balance_cents) values
  ('ac000000-0000-0000-0000-000000000001', current_setting('t.ws')::uuid, 'Conta', 100000),
  ('ac000000-0000-0000-0000-000000000002', current_setting('t.ws')::uuid, 'Poupança', 0);
-- Janeiro/2025: salário 1000, despesa 300
insert into transactions (workspace_id, kind, amount_cents, description, occurred_on, payment_method, account_id) values
  (current_setting('t.ws')::uuid, 'income', 100000, 'Salário', '2025-01-05', 'transfer', 'ac000000-0000-0000-0000-000000000001'),
  (current_setting('t.ws')::uuid, 'expense', 30000, 'Mercado', '2025-01-10', 'debit', 'ac000000-0000-0000-0000-000000000001');

insert into goals (id, workspace_id, name, target_cents, target_date, priority, reserve_account_id) values
  ('90000000-0000-0000-0000-000000000001', current_setting('t.ws')::uuid, 'Carro', 50000, '2026-12-31', 1, 'ac000000-0000-0000-0000-000000000002');
insert into goals (id, workspace_id, name, target_cents) values
  ('90000000-0000-0000-0000-000000000002', current_setting('t.ws')::uuid, 'Viagem (caixinha)', 10000);

-- -----------------------------------------------------------------------------
-- Regra contábil: aporte NÃO é despesa (ADR-0016)
-- -----------------------------------------------------------------------------
insert into goal_contributions (workspace_id, goal_id, amount_cents, contributed_on, account_id) values
  (current_setting('t.ws')::uuid, '90000000-0000-0000-0000-000000000001', 20000, '2025-01-15', 'ac000000-0000-0000-0000-000000000001');

select results_eq(
  $$ select income_cents, expense_cents from analytics_totals(current_setting('t.ws')::uuid, '2025-01-01', '2025-01-31') $$,
  $$ values (100000::bigint, 30000::bigint) $$, 'aporte não entra em despesas do mês');
select results_eq(
  $$ select saved_cents, deposited_cents, withdrawn_cents from analytics_savings(current_setting('t.ws')::uuid, '2025-01-01', '2025-01-31') $$,
  $$ values (20000::bigint, 20000::bigint, 0::bigint) $$, '"guardado no mês" separado das despesas');
select results_eq(
  $$ select name, balance_cents from account_balances where workspace_id = current_setting('t.ws')::uuid order by name $$,
  $$ values ('Conta', 150000::bigint), ('Poupança', 20000::bigint) $$,
  'aporte sai da conta de origem e entra na conta de reserva (100000 + 1000·100 − 300·100 − 200·100)');
select is((select sum(balance_cents) from account_balances where workspace_id = current_setting('t.ws')::uuid), 170000::numeric,
  'com conta de reserva, o patrimônio total não muda: nada sumiu nem foi contado duas vezes');
select is((select saved_cents from goal_summaries where goal_id = '90000000-0000-0000-0000-000000000001'), 20000::bigint,
  'meta soma o aporte');

-- Caixinha sem conta: sai da conta, fica guardado na meta
insert into goal_contributions (workspace_id, goal_id, amount_cents, contributed_on, account_id) values
  (current_setting('t.ws')::uuid, '90000000-0000-0000-0000-000000000002', 5000, '2025-01-20', 'ac000000-0000-0000-0000-000000000001');
select is((select balance_cents from account_balances where account_id = 'ac000000-0000-0000-0000-000000000001'), 145000::bigint,
  'caixinha sem conta: dinheiro sai do saldo disponível');
select is((select sum(balance_cents) from account_balances where workspace_id = current_setting('t.ws')::uuid)
          + (select sum(saved_cents) from goal_summaries where workspace_id = current_setting('t.ws')::uuid and reserve_account_id is null),
          170000::numeric, 'saldo das contas + caixinhas = patrimônio (não some dinheiro)');
select results_eq(
  $$ select expense_cents from analytics_totals(current_setting('t.ws')::uuid, '2025-01-01', '2025-01-31') $$,
  $$ values (30000::bigint) $$, 'caixinha também não vira despesa');
select is((select balance_cents from analytics_position(current_setting('t.ws')::uuid, '2025-01-31')), 165000::bigint,
  'saldo em data passada desconta o aporte da caixinha (reserva conta como conta)');

-- -----------------------------------------------------------------------------
-- Retirada, limites e status (RN-73…RN-76)
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into goal_contributions (workspace_id, goal_id, amount_cents, contributed_on, account_id)
     values (current_setting('t.ws')::uuid, '90000000-0000-0000-0000-000000000001', -1000, '2025-02-01', 'ac000000-0000-0000-0000-000000000001') $$,
  '23514', null, 'retirada exige motivo');
select throws_ok(
  $$ insert into goal_contributions (workspace_id, goal_id, amount_cents, contributed_on, account_id, note)
     values (current_setting('t.ws')::uuid, '90000000-0000-0000-0000-000000000001', -20001, '2025-02-01', 'ac000000-0000-0000-0000-000000000001', 'Emergência') $$,
  '23514', 'A retirada é maior que o valor guardado na meta', 'retirada não pode passar do guardado');
select lives_ok(
  $$ insert into goal_contributions (workspace_id, goal_id, amount_cents, contributed_on, account_id, note)
     values (current_setting('t.ws')::uuid, '90000000-0000-0000-0000-000000000001', -20000, '2025-02-01', 'ac000000-0000-0000-0000-000000000001', 'Emergência') $$,
  'retirada que zera a meta é permitida');
select is((select saved_cents from goal_summaries where goal_id = '90000000-0000-0000-0000-000000000001'), 0::bigint, 'meta zerada');
select is((select balance_cents from account_balances where account_id = 'ac000000-0000-0000-0000-000000000002'), 0::bigint,
  'retirada devolve da reserva para a conta');
select results_eq(
  $$ select saved_cents, withdrawn_cents from analytics_savings(current_setting('t.ws')::uuid, '2025-02-01', '2025-02-28') $$,
  $$ values (-20000::bigint, 20000::bigint) $$, 'guardado no mês fica negativo com retirada');

-- Aporte maior que o restante → concluída; retirada abaixo do alvo → ativa de novo
insert into goal_contributions (workspace_id, goal_id, amount_cents, contributed_on, account_id) values
  (current_setting('t.ws')::uuid, '90000000-0000-0000-0000-000000000002', 7000, '2025-03-01', 'ac000000-0000-0000-0000-000000000001');
select results_eq(
  $$ select status::text, saved_cents from goal_summaries where goal_id = '90000000-0000-0000-0000-000000000002' $$,
  $$ values ('achieved', 12000::bigint) $$, 'aporte maior que o restante conclui a meta (excedente fica registrado)');
select isnt((select achieved_at from goals where id = '90000000-0000-0000-0000-000000000002'), null, 'data de conclusão gravada');
insert into goal_contributions (workspace_id, goal_id, amount_cents, contributed_on, account_id, note) values
  (current_setting('t.ws')::uuid, '90000000-0000-0000-0000-000000000002', -3000, '2025-03-02', 'ac000000-0000-0000-0000-000000000001', 'Passagem');
select is((select status::text from goals where id = '90000000-0000-0000-0000-000000000002'), 'active', 'retirada abaixo do alvo reativa a meta');
update goals set target_cents = 9000 where id = '90000000-0000-0000-0000-000000000002';
select is((select status::text from goals where id = '90000000-0000-0000-0000-000000000002'), 'achieved', 'baixar o alvo para o guardado conclui');

-- Meta com valor inicial já guardado
insert into goals (id, workspace_id, name, target_cents, initial_cents) values
  ('90000000-0000-0000-0000-000000000003', current_setting('t.ws')::uuid, 'Reserva', 100000, 30000);
select is((select saved_cents from goal_summaries where goal_id = '90000000-0000-0000-0000-000000000003'), 30000::bigint,
  'valor inicial conta no progresso');
-- aportes até aqui: 200 − 200 + 50 + 70 − 30 = 90 (os R$ 300 iniciais não entram)
select is((select saved_cents from analytics_savings(current_setting('t.ws')::uuid, '2020-01-01', '2030-12-31')), 9000::bigint,
  'valor inicial NÃO conta como "guardado" (não é movimento de dinheiro)');

-- Arquivada não recebe aporte
update goals set status = 'archived' where id = '90000000-0000-0000-0000-000000000003';
select throws_ok(
  $$ insert into goal_contributions (workspace_id, goal_id, amount_cents, contributed_on) values
     (current_setting('t.ws')::uuid, '90000000-0000-0000-0000-000000000003', 1000, '2025-03-05') $$,
  '23514', 'Meta arquivada não recebe aportes', 'meta arquivada não recebe aporte');

-- -----------------------------------------------------------------------------
-- Aporte planejado = recorrência com goal_id (RN-77)
-- -----------------------------------------------------------------------------
insert into goals (id, workspace_id, name, target_cents) values
  ('90000000-0000-0000-0000-000000000004', current_setting('t.ws')::uuid, 'Planejada', 1000000);
insert into recurrences (id, workspace_id, kind, description, amount_cents, payment_method, account_id, day_of_month, starts_on, goal_id)
values ('9e000000-0000-0000-0000-000000000001', current_setting('t.ws')::uuid, 'expense', 'Guardar', 50000, 'transfer',
        'ac000000-0000-0000-0000-000000000001', 5, private.add_months(private.today_sp(), -1), '90000000-0000-0000-0000-000000000004');
select is((select count(*)::int from goal_contributions where recurrence_id = '9e000000-0000-0000-0000-000000000001'), 2,
  'recorrência de meta gera aportes previstos (mês passado e atual), não lançamentos');
select is((select count(*)::int from transactions where recurrence_id = '9e000000-0000-0000-0000-000000000001'), 0,
  'nenhuma despesa criada pela recorrência de meta');
select is((select saved_cents from goal_summaries where goal_id = '90000000-0000-0000-0000-000000000004'), 0::bigint,
  'previsto não conta como guardado');
select is((select planned_cents from goal_summaries where goal_id = '90000000-0000-0000-0000-000000000004'), 100000::bigint,
  'previsto aparece separado');
select is((select plan_amount_cents from goal_summaries where goal_id = '90000000-0000-0000-0000-000000000004'), 50000::bigint,
  'plano mensal exposto no resumo');
select is(public.generate_workspace_recurrences(current_setting('t.ws')::uuid), 0,
  'gerar de novo não duplica');
update goal_contributions set is_planned = false
 where recurrence_id = '9e000000-0000-0000-0000-000000000001' and contributed_on = (
   select min(contributed_on) from goal_contributions where recurrence_id = '9e000000-0000-0000-0000-000000000001');
select is((select saved_cents from goal_summaries where goal_id = '90000000-0000-0000-0000-000000000004'), 50000::bigint,
  'confirmar o previsto vira guardado');

-- -----------------------------------------------------------------------------
-- Motor de projeção (ADR-0017)
-- -----------------------------------------------------------------------------
insert into recurrences (workspace_id, kind, description, amount_cents, payment_method, account_id, day_of_month, starts_on, auto_confirm)
values (current_setting('t.ws')::uuid, 'expense', 'Aluguel', 150000, 'pix', 'ac000000-0000-0000-0000-000000000001', 10,
        private.month_start(private.today_sp()), false);

select results_eq(
  $$ select income_cents, income_planned_cents, expense_cents, expense_planned_cents
     from analytics_totals(current_setting('t.ws')::uuid, private.month_start(private.today_sp()), private.add_months(private.today_sp(), 1) - 1) $$,
  $$ select coalesce(sum(amount_cents) filter (where kind = 'income' and not is_planned), 0)::bigint,
            coalesce(sum(amount_cents) filter (where kind = 'income' and is_planned), 0)::bigint,
            coalesce(sum(amount_cents) filter (where kind = 'expense' and not is_planned), 0)::bigint,
            coalesce(sum(amount_cents) filter (where kind = 'expense' and is_planned), 0)::bigint
     from analytics_entries(current_setting('t.ws')::uuid, private.month_start(private.today_sp()),
                            private.add_months(private.today_sp(), 1) - 1, 'accrual', p_include_projected => false) $$,
  'mês atual: projeção = exatamente os números da Fase 3 (sem linhas virtuais)');
select is((select count(*)::int from analytics_entries(current_setting('t.ws')::uuid, private.month_start(private.today_sp()),
           private.add_months(private.today_sp(), 1) - 1) where is_projected), 0, 'nenhuma linha virtual no mês atual');
select results_eq(
  $$ select expense_planned_cents from analytics_totals(current_setting('t.ws')::uuid, private.add_months(private.today_sp(), 6),
                                                         private.add_months(private.today_sp(), 7) - 1) $$,
  $$ values (150000::bigint) $$, 'daqui a 6 meses: o aluguel aparece projetado a partir da regra');
select is((select count(*)::int from analytics_monthly(current_setting('t.ws')::uuid, private.add_months(private.today_sp(), 1),
           private.add_months(private.today_sp(), 36)) where expense_planned_cents >= 150000), 36,
  'projeção cobre 36 meses à frente');
select is((select count(*)::int from transactions where description = 'Aluguel'), 1,
  'projeção não grava nada no banco (só o mês atual foi gerado)');
select cmp_ok((select projected_balance_cents from analytics_position(current_setting('t.ws')::uuid, private.add_months(private.today_sp(), 4) - 1)),
  '<', (select projected_balance_cents from analytics_position(current_setting('t.ws')::uuid, private.add_months(private.today_sp(), 1) - 1)),
  'saldo projetado de meses futuros desconta aluguéis e aportes planejados projetados');
select is((select planned_savings_cents from analytics_position(current_setting('t.ws')::uuid, private.add_months(private.today_sp(), 1) - 1)),
  (select coalesce(sum(amount_cents), 0)::bigint from goal_contributions where is_planned and contributed_on <= private.add_months(private.today_sp(), 1) - 1
     and workspace_id = current_setting('t.ws')::uuid),
  'aportes previstos para caixinha entram no saldo projetado');

select is((select count(*)::int from planning_capacity_inputs(current_setting('t.ws')::uuid, 6)), 7,
  'capacidade: 6 meses fechados + próximo mês projetado');
select is((select expense_fixed_cents from planning_capacity_inputs(current_setting('t.ws')::uuid, 6) where is_projection), 150000::bigint,
  'despesa fixa do próximo mês vem da projeção');

-- -----------------------------------------------------------------------------
-- RLS: família vê metas da família; individual só o dono; estranho nada.
-- -----------------------------------------------------------------------------
insert into goals (workspace_id, name, target_cents) values (current_setting('t.wsa')::uuid, 'Meta só da Alice', 1000);
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@test.dev"}';
select is((select count(*)::int from goal_summaries where workspace_id = current_setting('t.ws')::uuid), 4, 'Bob (membro) vê as metas da família (Carro, Viagem, Reserva, Planejada)');
select is((select count(*)::int from goals where name = 'Meta só da Alice'), 0, 'Bob não vê meta do espaço individual da Alice');
set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","email":"carol@test.dev"}';
select is((select count(*)::int from goal_contributions), 0, 'Carol (estranha) não vê aportes');
select throws_ok(
  $$ insert into goal_contributions (workspace_id, goal_id, amount_cents) values
     (current_setting('t.ws')::uuid, '90000000-0000-0000-0000-000000000001', 100) $$,
  '42501', null, 'Carol não aporta em meta de outra família');

select * from finish();
rollback;
