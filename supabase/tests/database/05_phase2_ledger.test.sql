-- Fase 2: faturas, parcelas, recorrências, saldos, pagamentos, transferências, auditoria.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
select plan(50);

-- -----------------------------------------------------------------------------
-- Regra da fatura (RN-10) — mesmos casos de src/lib/domain/__tests__/invoice.test.ts
-- -----------------------------------------------------------------------------
select results_eq($$ select * from private.invoice_cycle(3, 10, '2026-11-02') $$,
  $$ values ('2026-11-01'::date, '2026-11-03'::date, '2026-11-10'::date) $$, 'compra antes do fechamento → fatura do mês');
select results_eq($$ select * from private.invoice_cycle(3, 10, '2026-11-03') $$,
  $$ values ('2026-12-01'::date, '2026-12-03'::date, '2026-12-10'::date) $$, 'compra NO dia do fechamento → fatura seguinte');
select results_eq($$ select * from private.invoice_cycle(25, 5, '2026-11-10') $$,
  $$ values ('2026-12-01'::date, '2026-11-25'::date, '2026-12-05'::date) $$, 'vencimento antes do fechamento → vence no mês seguinte');
select results_eq($$ select * from private.invoice_cycle(25, 5, '2026-12-26') $$,
  $$ values ('2027-02-01'::date, '2027-01-25'::date, '2027-02-05'::date) $$, 'virada de ano');
select results_eq($$ select * from private.invoice_cycle(31, 10, '2026-02-27') $$,
  $$ values ('2026-03-01'::date, '2026-02-28'::date, '2026-03-10'::date) $$, 'fechamento dia 31 em fevereiro = dia 28');
select results_eq($$ select * from private.invoice_cycle(31, 10, '2026-02-28') $$,
  $$ values ('2026-04-01'::date, '2026-03-31'::date, '2026-04-10'::date) $$, 'compra no último dia de fevereiro (fechamento) → próximo ciclo');
select results_eq($$ select * from private.invoice_cycle(30, 7, '2028-02-29') $$,
  $$ values ('2028-04-01'::date, '2028-03-30'::date, '2028-04-07'::date) $$, 'ano bissexto: 29/02 ≥ fechamento (30→29) → próximo');

-- -----------------------------------------------------------------------------
-- Fixtures
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
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';

insert into accounts (id, workspace_id, name, initial_balance_cents) values
  ('ac000000-0000-0000-0000-000000000001', current_setting('t.ws')::uuid, 'Conta', 100000),
  ('ac000000-0000-0000-0000-000000000002', current_setting('t.ws')::uuid, 'Poupança', 0);
insert into credit_cards (id, workspace_id, name, closing_day, due_day, limit_cents) values
  ('cc000000-0000-0000-0000-000000000001', current_setting('t.ws')::uuid, 'Nubank', 3, 10, 500000);
select set_config('t.cat', (select id::text from categories where workspace_id = current_setting('t.ws')::uuid and name = 'Mercado'), false);
select set_config('t.cat2', (select id::text from categories where workspace_id = current_setting('t.ws')::uuid and name = 'Compras'), false);

-- -----------------------------------------------------------------------------
-- Crédito: fatura atribuída automaticamente
-- -----------------------------------------------------------------------------
insert into transactions (id, workspace_id, kind, amount_cents, description, occurred_on, payment_method, card_id, category_id)
values ('aa000000-0000-0000-0000-000000000001', current_setting('t.ws')::uuid, 'expense', 5000, 'Uber',
        '2026-11-03', 'credit', 'cc000000-0000-0000-0000-000000000001', current_setting('t.cat')::uuid);
select is((select ci.reference_month from transactions t join card_invoices ci on ci.id = t.invoice_id
           where t.id = 'aa000000-0000-0000-0000-000000000001'), '2026-12-01'::date,
  'compra no crédito recebe a fatura automaticamente (dia do fechamento → dezembro)');

update transactions set occurred_on = '2026-11-01' where id = 'aa000000-0000-0000-0000-000000000001';
select is((select ci.reference_month from transactions t join card_invoices ci on ci.id = t.invoice_id
           where t.id = 'aa000000-0000-0000-0000-000000000001'), '2026-11-01'::date,
  'mudar a data da compra move para a fatura correta');

-- -----------------------------------------------------------------------------
-- Parcelamento (RN-11)
-- -----------------------------------------------------------------------------
select set_config('t.p1', public.create_card_purchase(current_setting('t.ws')::uuid, 'cc000000-0000-0000-0000-000000000001',
  10000, 3, 'Fone', '2026-11-20', current_setting('t.cat2')::uuid)::text, false);
select results_eq($$ select amount_cents from transactions where installment_plan_id =
                     (select installment_plan_id from transactions where id = current_setting('t.p1')::uuid)
                     order by installment_number $$,
  $$ values (3334::bigint), (3333::bigint), (3333::bigint) $$, 'R$ 100 em 3x = 33,34 + 33,33 + 33,33');
select results_eq($$ select ci.reference_month from transactions t join card_invoices ci on ci.id = t.invoice_id
                     where t.installment_plan_id = (select installment_plan_id from transactions where id = current_setting('t.p1')::uuid)
                     order by t.installment_number $$,
  $$ values ('2026-12-01'::date), ('2027-01-01'::date), ('2027-02-01'::date) $$,
  'parcelas em faturas consecutivas, atravessando o ano');
select results_eq($$ select occurred_on from transactions
                     where installment_plan_id = (select installment_plan_id from transactions where id = current_setting('t.p1')::uuid)
                     order by installment_number $$,
  $$ values ('2026-11-20'::date), ('2026-12-20'::date), ('2027-01-20'::date) $$, 'competência de cada parcela = compra + (k−1) meses');

select set_config('t.p2', public.create_card_purchase(current_setting('t.ws')::uuid, 'cc000000-0000-0000-0000-000000000001',
  1001, 2, 'Centavos ímpares', '2027-01-31')::text, false);
select results_eq($$ select amount_cents, occurred_on from transactions
                     where installment_plan_id = (select installment_plan_id from transactions where id = current_setting('t.p2')::uuid)
                     order by installment_number $$,
  $$ values (501::bigint, '2027-01-31'::date), (500::bigint, '2027-02-28'::date) $$,
  'centavo ímpar na 1ª parcela; 31/01 + 1 mês = 28/02');
select throws_ok($$ select public.create_card_purchase(current_setting('t.ws')::uuid, 'cc000000-0000-0000-0000-000000000001', 1, 2, 'x', '2026-11-01') $$,
  '22023', null, 'valor menor que o número de parcelas é recusado');

-- Excluir "esta e as futuras"
select is(public.delete_installments(
  (select id from transactions where installment_plan_id = (select installment_plan_id from transactions where id = current_setting('t.p1')::uuid) and installment_number = 2),
  'this_and_future'), 2, 'excluir parcela 2 e futuras remove 2 parcelas');
select is((select count(*)::int from transactions where installment_plan_id =
           (select installment_plan_id from transactions where id = current_setting('t.p1')::uuid)), 1, 'sobra a parcela 1');
select is(public.update_installments(current_setting('t.p2')::uuid, 'all', 'Renomeado', null, null, null), 2,
  'editar "todas" altera as 2 parcelas');

-- -----------------------------------------------------------------------------
-- Pagamento de fatura: NÃO é despesa; baixa saldo da conta (RN-53)
-- -----------------------------------------------------------------------------
select set_config('t.inv', (select invoice_id::text from transactions where id = 'aa000000-0000-0000-0000-000000000001'), false);
-- "Hoje" nos testes é a data real; a fatura de nov/2026 venceu em 10/11.
select ok((select status from card_invoice_summaries where invoice_id = current_setting('t.inv')::uuid) in ('closed', 'overdue'),
  'fatura de novembro (fechada em 03/11) não está mais aberta');
select set_config('t.exp_before', (select sum(amount_cents)::text from transactions where workspace_id = current_setting('t.ws')::uuid and kind = 'expense'), false);
insert into invoice_payments (workspace_id, invoice_id, account_id, amount_cents, paid_on)
values (current_setting('t.ws')::uuid, current_setting('t.inv')::uuid, 'ac000000-0000-0000-0000-000000000001', 5000, '2026-11-10');
select is((select status from card_invoice_summaries where invoice_id = current_setting('t.inv')::uuid), 'paid',
  'fatura paga quando pagamentos ≥ total');
select is((select sum(amount_cents)::text from transactions where workspace_id = current_setting('t.ws')::uuid and kind = 'expense'),
  current_setting('t.exp_before'), 'pagar a fatura não cria nem duplica despesa');

-- -----------------------------------------------------------------------------
-- Transferência + saldo da conta (RN-50, RN-52)
-- -----------------------------------------------------------------------------
insert into transfers (workspace_id, from_account_id, to_account_id, amount_cents, occurred_on)
values (current_setting('t.ws')::uuid, 'ac000000-0000-0000-0000-000000000001', 'ac000000-0000-0000-0000-000000000002', 20000, '2026-11-11');
insert into transactions (workspace_id, kind, amount_cents, description, occurred_on, payment_method, account_id) values
  (current_setting('t.ws')::uuid, 'income', 30000, 'Freela', '2026-11-12', 'pix', 'ac000000-0000-0000-0000-000000000001');
insert into transactions (workspace_id, kind, amount_cents, description, occurred_on, payment_method, account_id, is_settled) values
  (current_setting('t.ws')::uuid, 'expense', 7000, 'Luz (prevista)', '2026-11-20', 'pix', 'ac000000-0000-0000-0000-000000000001', false);
-- 1000,00 + 300,00 − 200,00 (transf.) − 50,00 (fatura) = 1050,00 ; previsto −70,00 fica separado
select is((select balance_cents from account_balances where account_id = 'ac000000-0000-0000-0000-000000000001'), 105000::bigint,
  'saldo = inicial + receitas − despesas pagas ± transferências − pagamentos de fatura');
select is((select pending_cents from account_balances where account_id = 'ac000000-0000-0000-0000-000000000001'), -7000::bigint,
  'lançamento previsto não entra no saldo, aparece como pendente');
select is((select balance_cents from account_balances where account_id = 'ac000000-0000-0000-0000-000000000002'), 20000::bigint,
  'transferência entra na conta de destino');
select is((select count(*)::int from transactions where workspace_id = current_setting('t.ws')::uuid and description ilike '%transf%'), 0,
  'transferência não vira receita nem despesa');

-- -----------------------------------------------------------------------------
-- Limite do cartão (RN-55)
-- -----------------------------------------------------------------------------
-- Gastos: 5000 (Uber, paga) + 3334 (parcela restante) + 1001 (2 parcelas) = 9335; pago 5000 → usado 4335
select is((select used_cents from credit_card_summaries where card_id = 'cc000000-0000-0000-0000-000000000001'), 4335::bigint,
  'limite usado = compras (inclui parcelas futuras) − pagamentos');
select is((select available_cents from credit_card_summaries where card_id = 'cc000000-0000-0000-0000-000000000001'), 495665::bigint,
  'limite disponível');

-- -----------------------------------------------------------------------------
-- Recorrências (RN-14, RN-15, RN-16)
-- -----------------------------------------------------------------------------
insert into recurrences (id, workspace_id, kind, description, amount_cents, payment_method, account_id, day_of_month, starts_on)
values ('ae000000-0000-0000-0000-000000000001', current_setting('t.ws')::uuid, 'expense', 'Aluguel', 150000, 'pix',
        'ac000000-0000-0000-0000-000000000001', 31, '2027-01-01');
reset role;
select is(private.generate_recurrence('ae000000-0000-0000-0000-000000000001', '2027-04-30'), 4, 'gera 4 meses');
select results_eq($$ select recurrence_date from transactions where recurrence_id = 'ae000000-0000-0000-0000-000000000001' order by 1 $$,
  $$ values ('2027-01-31'::date), ('2027-02-28'::date), ('2027-03-31'::date), ('2027-04-30'::date) $$,
  'dia 31 → último dia nos meses curtos');
select is(private.generate_recurrence('ae000000-0000-0000-0000-000000000001', '2027-04-30'), 0, 'rodar de novo não duplica (idempotente)');
update recurrences set last_generated_on = null where id = 'ae000000-0000-0000-0000-000000000001';
select is(private.generate_recurrence('ae000000-0000-0000-0000-000000000001', '2027-04-30'), 0,
  'mesmo perdendo o marcador, o índice único impede duplicata');
select is((select bool_and(not is_settled) from transactions where recurrence_id = 'ae000000-0000-0000-0000-000000000001'), true,
  'gerados como previstos por padrão');

insert into recurrences (id, workspace_id, kind, description, amount_cents, payment_method, card_id, day_of_month, starts_on, auto_confirm, frequency)
values ('ae000000-0000-0000-0000-000000000002', current_setting('t.ws')::uuid, 'expense', 'Streaming', 3990, 'credit',
        'cc000000-0000-0000-0000-000000000001', 3, '2027-01-03', true, 'monthly');
select is(private.generate_recurrence('ae000000-0000-0000-0000-000000000002', '2027-02-28'), 2, 'assinatura no cartão');
select is((select bool_and(is_settled and invoice_id is not null) from transactions where recurrence_id = 'ae000000-0000-0000-0000-000000000002'),
  true, 'auto_confirm → confirmados e já na fatura');

insert into recurrences (id, workspace_id, kind, description, amount_cents, payment_method, day_of_month, starts_on, frequency)
values ('ae000000-0000-0000-0000-000000000003', current_setting('t.ws')::uuid, 'expense', 'Feira', 8000, 'cash', 1, '2027-01-04', 'weekly');
select is(private.generate_recurrence('ae000000-0000-0000-0000-000000000003', '2027-01-31'), 4, 'semanal: 4 ocorrências em janeiro');

insert into recurrences (id, workspace_id, kind, description, amount_cents, payment_method, day_of_month, starts_on, frequency)
values ('ae000000-0000-0000-0000-000000000004', current_setting('t.ws')::uuid, 'expense', 'Seguro', 90000, 'pix', 29, '2028-02-29', 'yearly');
select results_eq($$ select d from private.recurrence_dates('yearly', 29, '2028-02-29', null, '2028-01-01', '2030-12-31') d $$,
  $$ values ('2028-02-29'::date), ('2029-02-28'::date), ('2030-02-28'::date) $$, 'anual em 29/02 → 28/02 nos anos comuns');

-- -----------------------------------------------------------------------------
-- Categorias
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';
select throws_ok($$ select public.delete_category(current_setting('t.cat')::uuid) $$, '23503', null,
  'não exclui categoria em uso sem reatribuir');
select throws_ok($$ delete from categories where id = current_setting('t.cat')::uuid $$, '23503', null,
  'DELETE direto em categoria em uso é bloqueado pela FK');
select lives_ok($$ select public.delete_category(current_setting('t.cat')::uuid, current_setting('t.cat2')::uuid) $$,
  'exclui reatribuindo');
select is((select count(*)::int from transactions where id = 'aa000000-0000-0000-0000-000000000001' and category_id = current_setting('t.cat2')::uuid), 1,
  'lançamentos foram para a nova categoria');
select throws_ok($$ insert into categories (workspace_id, kind, name, parent_id)
                    values (current_setting('t.ws')::uuid, 'income', 'Sub errada', current_setting('t.cat2')::uuid) $$,
  '23514', null, 'subcategoria precisa ter o mesmo tipo da mãe');

-- -----------------------------------------------------------------------------
-- Permissões e auditoria
-- -----------------------------------------------------------------------------
-- Bob (membro) não exclui transferência da Alice.
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@test.dev"}';
delete from transfers where workspace_id = current_setting('t.ws')::uuid;
select is((select count(*)::int from transfers where workspace_id = current_setting('t.ws')::uuid), 1,
  'membro não exclui transferência de outra pessoa');
select ok((select count(*) from audit_log where workspace_id = current_setting('t.ws')::uuid) > 0, 'membro lê a auditoria do espaço');

-- Carol não vê nada.
set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","email":"carol@test.dev"}';
select is((select count(*)::int from account_balances where workspace_id = current_setting('t.ws')::uuid), 0, 'Carol não vê saldos');
select is((select count(*)::int from card_invoice_summaries where workspace_id = current_setting('t.ws')::uuid), 0, 'Carol não vê faturas');
select is((select count(*)::int from audit_log where workspace_id = current_setting('t.ws')::uuid), 0, 'Carol não vê auditoria');
select throws_ok($$ insert into invoice_payments (workspace_id, invoice_id, amount_cents, paid_on)
                    values (current_setting('t.ws')::uuid, current_setting('t.inv')::uuid, 100, '2026-11-15') $$,
  '42501', null, 'Carol não registra pagamento na família');

-- Desfazer exclusão mantém o autor original.
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';
insert into transactions (id, workspace_id, kind, amount_cents, description, occurred_on, payment_method)
values ('aa000000-0000-0000-0000-0000000000f1', current_setting('t.ws')::uuid, 'expense', 1200, 'Lanche', '2026-11-15', 'cash');
delete from transactions where id = 'aa000000-0000-0000-0000-0000000000f1';
select is((select actor_id from audit_log where record_id = 'aa000000-0000-0000-0000-0000000000f1' and action = 'DELETE'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'auditoria registra quem excluiu');
select lives_ok($$ select public.restore_deleted_transaction('aa000000-0000-0000-0000-0000000000f1') $$, 'desfaz a exclusão');
select is((select created_by from transactions where id = 'aa000000-0000-0000-0000-0000000000f1'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'restaurado com o autor original');
set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","email":"carol@test.dev"}';
select throws_ok($$ select public.restore_deleted_transaction('aa000000-0000-0000-0000-000000000001') $$, '22023', null,
  'sem exclusão recente não há o que desfazer');

reset role;
select * from finish();
rollback;
