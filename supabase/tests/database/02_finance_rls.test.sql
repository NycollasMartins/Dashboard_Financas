-- Testes de isolamento e integridade das tabelas financeiras e dos canais.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(22);

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.dev', 'authenticated', 'authenticated', '{"full_name":"Alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.dev',   'authenticated', 'authenticated', '{"full_name":"Bob"}'),
  ('33333333-3333-3333-3333-333333333333', 'carol@test.dev', 'authenticated', 'authenticated', '{"full_name":"Carol"}');

-- Monta a família: Alice (admin) + Bob (membro)
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';
select set_config('test.hh', public.create_household('Casa')::text, false);
select set_config('test.token', public.create_workspace_invite(current_setting('test.hh')::uuid, 'bob@test.dev'), false);
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@test.dev"}';
select public.accept_workspace_invite(current_setting('test.token'));

-- IDs auxiliares (lidos como superusuário)
reset role;
select set_config('test.cat_mercado', (select id::text from categories
  where workspace_id = current_setting('test.hh')::uuid and name = 'Mercado'), false);
select set_config('test.cat_salario', (select id::text from categories
  where workspace_id = current_setting('test.hh')::uuid and name = 'Salário'), false);
select set_config('test.carol_ws', (select id::text from workspaces
  where owner_id = '33333333-3333-3333-3333-333333333333'), false);
select set_config('test.carol_cat', (select id::text from categories
  where workspace_id = current_setting('test.carol_ws')::uuid and name = 'Mercado'), false);

-- -----------------------------------------------------------------------------
-- Alice lança uma despesa na família
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';

select lives_ok($$
  insert into transactions (id, workspace_id, kind, amount_cents, description, occurred_on, category_id, payment_method, created_by)
  values ('aaaaaaaa-0000-0000-0000-000000000001', current_setting('test.hh')::uuid, 'expense', 10000, 'Mercado',
          '2026-11-10', current_setting('test.cat_mercado')::uuid, 'pix',
          '33333333-3333-3333-3333-333333333333')  -- tentativa de forjar autoria
$$, 'Alice lança despesa na família');

select is((select created_by from transactions where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'created_by é sempre o usuário logado (não dá para forjar)');

select throws_ok($$
  insert into transactions (workspace_id, kind, amount_cents, description, occurred_on, category_id, payment_method)
  values (current_setting('test.hh')::uuid, 'income', 500, 'x', '2026-11-10', current_setting('test.cat_mercado')::uuid, 'pix')
$$, '23514', 'Categoria incompatível com o tipo do lançamento', 'categoria de despesa não serve para receita');

select throws_ok($$
  insert into transactions (workspace_id, kind, amount_cents, description, occurred_on, category_id, payment_method)
  values (current_setting('test.hh')::uuid, 'expense', 500, 'x', '2026-11-10', current_setting('test.carol_cat')::uuid, 'pix')
$$, '23503', null, 'não dá para usar categoria de outro espaço (FK composta)');

select throws_ok($$
  insert into transactions (workspace_id, kind, amount_cents, description, occurred_on, payment_method)
  values (current_setting('test.hh')::uuid, 'expense', 0, 'x', '2026-11-10', 'pix')
$$, '23514', null, 'valor precisa ser > 0 centavos');

select throws_ok($$
  insert into transactions (workspace_id, kind, amount_cents, description, occurred_on, payment_method)
  values (current_setting('test.hh')::uuid, 'expense', 100, 'x', '2026-11-10', 'credit')
$$, '23514', null, 'crédito exige cartão e fatura');

select throws_ok($$
  insert into transactions (workspace_id, kind, amount_cents, description, occurred_on, payment_method, member_user_id)
  values (current_setting('test.hh')::uuid, 'expense', 100, 'x', '2026-11-10', 'pix', '33333333-3333-3333-3333-333333333333')
$$, '23514', 'A pessoa indicada não é membro deste espaço', 'member_user_id precisa ser membro');

-- Cartão + fatura + compra no crédito
select lives_ok($$
  insert into credit_cards (id, workspace_id, name, closing_day, due_day)
  values ('cccccccc-0000-0000-0000-000000000001', current_setting('test.hh')::uuid, 'Nubank', 3, 10);
  insert into card_invoices (id, workspace_id, card_id, reference_month, closing_date, due_date)
  values ('dddddddd-0000-0000-0000-000000000001', current_setting('test.hh')::uuid,
          'cccccccc-0000-0000-0000-000000000001', '2026-12-01', '2026-12-03', '2026-12-10');
  insert into transactions (workspace_id, kind, amount_cents, description, occurred_on, payment_method, card_id, invoice_id)
  values (current_setting('test.hh')::uuid, 'expense', 4990, 'Uber', '2026-11-20', 'credit',
          'cccccccc-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001');
$$, 'compra no crédito com cartão e fatura do mesmo espaço');

-- -----------------------------------------------------------------------------
-- Bob (membro) vê, mas não altera/exclui o que não criou
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@test.dev"}';

select is((select count(*)::int from transactions where workspace_id = current_setting('test.hh')::uuid), 2,
  'Bob vê os lançamentos da família');

update transactions set amount_cents = 1 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
delete from transactions where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is((select amount_cents from transactions where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 10000::bigint,
  'membro não edita nem exclui lançamento de outra pessoa');

select lives_ok($$
  insert into transactions (id, workspace_id, kind, amount_cents, description, occurred_on, category_id, payment_method)
  values ('aaaaaaaa-0000-0000-0000-000000000002', current_setting('test.hh')::uuid, 'income', 500000, 'Salário Bob',
          '2026-11-05', current_setting('test.cat_salario')::uuid, 'transfer')
$$, 'Bob lança a própria receita');

select throws_ok($$
  update transactions set workspace_id = (select id from workspaces where kind = 'personal')
  where id = 'aaaaaaaa-0000-0000-0000-000000000002'
$$, '42501', 'A coluna workspace_id não pode ser alterada', 'não dá para mover lançamento de espaço');

-- -----------------------------------------------------------------------------
-- Carol (estranha) não vê nem escreve
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","email":"carol@test.dev"}';

select is((select count(*)::int from transactions), 0, 'Carol não vê lançamentos da família');
select is((select count(*)::int from credit_cards), 0, 'Carol não vê cartões da família');
select throws_ok($$
  insert into transactions (workspace_id, kind, amount_cents, description, occurred_on, payment_method)
  values (current_setting('test.hh')::uuid, 'expense', 100, 'invasão', '2026-11-10', 'pix')
$$, '42501', null, 'Carol não insere na família (RLS)');

-- -----------------------------------------------------------------------------
-- Alice (admin) pode excluir lançamento do Bob
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';
delete from transactions where id = 'aaaaaaaa-0000-0000-0000-000000000002';
select is((select count(*)::int from transactions where id = 'aaaaaaaa-0000-0000-0000-000000000002'), 0,
  'admin exclui lançamento de membro');

-- -----------------------------------------------------------------------------
-- Canais de mensagem
-- -----------------------------------------------------------------------------
select ok(public.create_channel_link_code('whatsapp') ~ '^[2-9A-Z]{8}$', 'gera código de vinculação de 8 caracteres');
select throws_ok($$ select * from channel_link_codes $$, '42501', null, 'cliente não lê códigos (hash)');
select throws_ok($$ select public.consume_channel_link_code('whatsapp', 'ABCDEFGH', '5511999999999') $$,
  '42501', null, 'cliente não consome código (só service_role)');
select throws_ok($$ select public.hit_rate_limit('x', 60, 10) $$, '42501', null, 'cliente não mexe no rate limit');

-- service_role consome o código e cria o vínculo
reset role;
select set_config('test.code', (
  -- gera um código conhecido como Alice
  select public.create_channel_link_code('telegram')
  from (select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true)) s
), false);
set local role service_role;
select isnt(public.consume_channel_link_code('telegram', lower(current_setting('test.code')), '123456789'), null,
  'service_role vincula o chat com o código (case-insensitive)');
select is(public.consume_channel_link_code('telegram', current_setting('test.code'), '987654321'), null,
  'código é de uso único');

reset role;
select * from finish();
rollback;
