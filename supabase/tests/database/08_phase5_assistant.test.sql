-- Fase 5: assistente — histórico/sessão/ações só do próprio usuário, regras de
-- categoria por espaço, cota atômica por usuário/dia/provedor e rate limit.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
select plan(18);

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

insert into assistant_messages (role, body, workspace_id) values ('user', 'gastei 50 no uber', current_setting('t.ws')::uuid);
insert into assistant_sessions (state) values ('{"pending": {"id": "x"}}');
insert into accounts (id, workspace_id, name) values ('ac000000-0000-0000-0000-000000000001', current_setting('t.ws')::uuid, 'Conta');
insert into transactions (id, workspace_id, kind, amount_cents, description, occurred_on, payment_method, account_id, source)
values ('aa000000-0000-0000-0000-000000000001', current_setting('t.ws')::uuid, 'expense', 5000, 'Uber', '2025-01-10', 'pix',
        'ac000000-0000-0000-0000-000000000001', 'assistant');
insert into assistant_actions (workspace_id, batch_id, intent, original_text, record_table, record_id, provider)
values (current_setting('t.ws')::uuid, gen_random_uuid(), 'registrar_despesa', 'gastei 50 no uber', 'transactions',
        'aa000000-0000-0000-0000-000000000001', 'local');

select is((select source::text from transactions where id = 'aa000000-0000-0000-0000-000000000001'), 'assistant',
  'lançamento do assistente guarda a origem');
select is((select new_data ->> 'original_text' from audit_log where table_name = 'assistant_actions' order by id desc limit 1),
  'gastei 50 no uber', 'auditoria guarda a mensagem original da ação do assistente');
select is((select user_id from assistant_messages limit 1), '11111111-1111-1111-1111-111111111111'::uuid,
  'user_id preenchido pela sessão (default auth.uid())');

-- Regras de categoria valem para a família
select set_config('t.cat', (select id::text from categories where workspace_id = current_setting('t.ws')::uuid and name = 'Mercado'), false);
insert into category_rules (workspace_id, pattern, category_id) values (current_setting('t.ws')::uuid, 'padaria do ze', current_setting('t.cat')::uuid);

-- Bob (mesma família) não vê o histórico/sessão/ações da Alice, mas vê as regras da família
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@test.dev"}';
select is((select count(*)::int from assistant_messages), 0, 'Bob não vê o histórico da Alice');
select is((select count(*)::int from assistant_sessions), 0, 'Bob não vê a sessão da Alice');
select is((select count(*)::int from assistant_actions), 0, 'Bob não vê as ações do assistente da Alice');
select is((select count(*)::int from category_rules), 1, 'Bob vê as regras de categoria da família');
select throws_ok(
  $$ insert into assistant_messages (user_id, role, body) values ('11111111-1111-1111-1111-111111111111', 'user', 'forjado') $$,
  '42501', null, 'ninguém grava mensagem em nome de outro');
-- Delete/update de outro usuário não afeta nada
delete from assistant_messages;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';
select is((select count(*)::int from assistant_messages), 1, 'apagar histórico só apaga o próprio');

-- Carol (outra família) não vê regras nem grava ação no espaço da Casa
set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","email":"carol@test.dev"}';
select is((select count(*)::int from category_rules), 0, 'Carol não vê regras da Casa');
select throws_ok(
  $$ insert into assistant_actions (workspace_id, batch_id, intent, original_text, record_table, record_id)
     values (current_setting('t.ws')::uuid, gen_random_uuid(), 'x', 'x', 'transactions', gen_random_uuid()) $$,
  '42501', null, 'Carol não registra ação em espaço alheio');
select throws_ok(
  $$ insert into assistant_usage (user_id, day, provider, calls) values ('33333333-3333-3333-3333-333333333333', current_date, 'gemini', -100) $$,
  '42501', null, 'cota não pode ser gravada direto (só pela função)');

-- Cota: limite diário por usuário/provedor e rate limit por minuto
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';
select results_eq($$ select allowed, used_today from assistant_take_quota('gemini', 2, 100) $$, $$ values (true, 1) $$, '1ª chamada liberada');
select results_eq($$ select allowed, used_today from assistant_take_quota('gemini', 2, 100) $$, $$ values (true, 2) $$, '2ª chamada liberada');
select results_eq($$ select allowed, used_today, reason from assistant_take_quota('gemini', 2, 100) $$, $$ values (false, 2, 'daily_limit') $$,
  'limite diário atingido → bloqueia sem incrementar');
select results_eq($$ select allowed from assistant_take_quota('groq', 2, 100) $$, $$ values (true) $$, 'cota é por provedor (Groq ainda livre)');
select results_eq($$ select allowed, reason from assistant_take_quota('groq', 50, 3) $$, $$ values (false, 'rate_limit') $$,
  'rate limit por minuto (já houve 4 chamadas no minuto)');
select throws_ok($$ select * from assistant_take_quota('openai', 10, 10) $$, '22023', null, 'provedor fora da lista é recusado');

select * from finish();
rollback;
