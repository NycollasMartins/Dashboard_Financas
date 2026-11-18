-- Fase 6: vínculo do Telegram (um chat por usuário), idempotência/dead-letter,
-- notificações (RLS, preferências, idempotência, silêncio, retentativas) e cota de mídia.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
select plan(27);

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.dev', 'authenticated', 'authenticated', '{"full_name":"Alice Souza"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.dev',   'authenticated', 'authenticated', '{"full_name":"Bob"}'),
  ('33333333-3333-3333-3333-333333333333', 'carol@test.dev', 'authenticated', 'authenticated', '{"full_name":"Carol"}');

set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';
select set_config('t.ws', public.create_household('Casa')::text, false);
select set_config('t.tok', public.create_workspace_invite(current_setting('t.ws')::uuid, 'bob@test.dev'), false);
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@test.dev"}';
select public.accept_workspace_invite(current_setting('t.tok'));

-- ---------------------------------------------------------------- Telegram
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';
select set_config('t.c1', public.create_channel_link_code('telegram'), false);
reset role;
set local role service_role;
select isnt(public.consume_channel_link_code('telegram', current_setting('t.c1'), '900001', 'Alice'), null, 'código válido vincula o chat');
select is(public.consume_channel_link_code('telegram', current_setting('t.c1'), '900001', 'Alice'), null, 'código é de uso único');
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';
select set_config('t.c2', public.create_channel_link_code('telegram'), false);
reset role;
set local role service_role;
select isnt(public.consume_channel_link_code('telegram', current_setting('t.c2'), '900002', 'Alice 2'), null, 'vincular outro chat funciona');
select is((select count(*)::int from channel_links where user_id = '11111111-1111-1111-1111-111111111111' and channel = 'telegram'), 1,
  'um chat por usuário: o vínculo anterior é removido');
select is((select external_id from channel_links where user_id = '11111111-1111-1111-1111-111111111111'), '900002', 'fica o chat novo');
select is(public.consume_channel_link_code('telegram', 'ZZZZZZZZ', '900003', 'X'), null, 'código inexistente não vincula');

insert into telegram_updates (update_id, chat_id, kind) values (1001, 900002, 'text');
select throws_ok($$ insert into telegram_updates (update_id, chat_id, kind) values (1001, 900002, 'text') $$,
  '23505', null, 'mesmo update_id não é processado duas vezes (idempotência)');
reset role;
set local role authenticated;
select throws_ok($$ select * from telegram_updates $$, '42501', null, 'cliente não lê a tabela de updates do Telegram');
select throws_ok($$ select * from ops_dead_letters $$, '42501', null, 'dead-letter só para o servidor');

-- ---------------------------------------------------------------- Push e preferências (RLS)
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';
insert into push_subscriptions (endpoint, p256dh, auth) values
  ('https://web.push.apple.com/abc', 'BOrandomp256dhkeyvalue000000000000', 'authsecret12');
select throws_ok($$ insert into push_subscriptions (user_id, endpoint, p256dh, auth)
  values ('22222222-2222-2222-2222-222222222222', 'https://x.example/forjado', 'BOrandomp256dhkeyvalue000000000000', 'authsecret12') $$,
  '42501', null, 'ninguém registra push em nome de outro');
select throws_ok($$ insert into push_subscriptions (endpoint, p256dh, auth) values ('http://inseguro', 'BOrandomp256dhkeyvalue000000000000', 'authsecret12') $$,
  '23514', null, 'endpoint de push precisa ser https');
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@test.dev"}';
select is((select count(*)::int from push_subscriptions), 0, 'Bob não vê os aparelhos da Alice');
-- Bob liga "lançamento de outro membro"
insert into notification_prefs (kind, enabled, push, telegram) values ('member_entry', true, true, false);

-- ---------------------------------------------------------------- Geração e idempotência
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';
insert into accounts (id, workspace_id, name) values ('ac000000-0000-0000-0000-000000000001', current_setting('t.ws')::uuid, 'Conta');
insert into notification_prefs (kind, enabled, push, telegram) values ('bill_due', false, false, false);
insert into transactions (workspace_id, kind, amount_cents, description, occurred_on, payment_method, account_id, is_settled)
values (current_setting('t.ws')::uuid, 'expense', 15000, 'Luz', private.today_sp() + 1, 'pix', 'ac000000-0000-0000-0000-000000000001', false);
reset role;
select set_config('t.n1', private.generate_notifications((private.today_sp()::timestamp + time '09:00') at time zone 'America/Sao_Paulo')::text, false);
select is((select count(*)::int from notifications where kind = 'bill_due'), 1,
  'conta vencendo amanhã notifica só quem não desligou (Bob sim, Alice desligou)');
select is((select user_id from notifications where kind = 'bill_due'), '22222222-2222-2222-2222-222222222222'::uuid, 'quem recebe é o Bob');
select is(private.generate_notifications((private.today_sp()::timestamp + time '10:00') at time zone 'America/Sao_Paulo'), 0,
  'rodar de novo não duplica (event_key)');
select is(private.generate_notifications((private.today_sp()::timestamp + time '06:00') at time zone 'America/Sao_Paulo'), 0,
  'antes das 08:00 nada é gerado');
select is((select body from notifications where kind = 'bill_due'), 'Luz · R$ 150,00', 'texto com valor em reais');
select is((select count(*)::int from notification_deliveries d join notifications n on n.id = d.notification_id where n.kind = 'bill_due'), 2,
  'uma entrega por canal (push + telegram)');

-- Lançamento de outro membro: só o Bob (que ligou), não a própria Alice
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';
insert into transactions (workspace_id, kind, amount_cents, description, occurred_on, payment_method, account_id)
values (current_setting('t.ws')::uuid, 'expense', 4590, 'iFood', private.today_sp(), 'pix', 'ac000000-0000-0000-0000-000000000001');
reset role;
select is((select string_agg(user_id::text || '|' || title, ',') from notifications where kind = 'member_entry' and body like 'iFood%'),
  '22222222-2222-2222-2222-222222222222|Alice lançou um gasto', 'lançamento de outro membro: só para quem ligou, com o primeiro nome');

-- Meta atingida → todos os membros
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';
insert into goals (id, workspace_id, name, target_cents) values ('90000000-0000-0000-0000-000000000001', current_setting('t.ws')::uuid, 'Viagem', 10000);
insert into goal_contributions (workspace_id, goal_id, amount_cents, contributed_on, account_id)
values (current_setting('t.ws')::uuid, '90000000-0000-0000-0000-000000000001', 10000, private.today_sp(), 'ac000000-0000-0000-0000-000000000001');
select is((select count(*)::int from notifications where kind = 'goal_achieved'), 1, 'Alice vê a sua notificação de meta atingida (RLS)');
select throws_ok($$ insert into notifications (user_id, kind, event_key, title, body) values (auth.uid(), 'x', 'x', 'x', 'x') $$,
  '42501', null, 'cliente não cria notificação');
update notifications set read_at = now() where kind = 'goal_achieved';
select isnt((select read_at from notifications where kind = 'goal_achieved'), null, 'marcar como lida');
set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","email":"carol@test.dev"}';
select is((select count(*)::int from notifications), 0, 'Carol (outra família) não vê nada');

-- ---------------------------------------------------------------- Dispatcher: silêncio e retentativas
reset role;
insert into notification_settings (user_id, quiet_enabled, quiet_start, quiet_end)
values ('22222222-2222-2222-2222-222222222222', true, '00:00', '23:59:59');
set local role service_role;
select is((select count(*)::int from claim_notification_deliveries(100) c where c.user_id = '22222222-2222-2222-2222-222222222222'), 0,
  'horário de silêncio segura as entregas');
reset role;
update notification_settings set quiet_enabled = false where user_id = '22222222-2222-2222-2222-222222222222';
set local role service_role;
select set_config('t.d', (select delivery_id::text from claim_notification_deliveries(100) c
  where c.user_id = '22222222-2222-2222-2222-222222222222' and c.channel = 'push' limit 1), false);
select is((select count(*)::int from claim_notification_deliveries(100) c where c.delivery_id = current_setting('t.d')::uuid), 0,
  'entrega pega por um disparo não é pega de novo (nunca duplica)');
select finish_notification_delivery(current_setting('t.d')::uuid, 'retry', 'HTTP 500');
update notification_deliveries set attempts = 5 where id = current_setting('t.d')::uuid;
select finish_notification_delivery(current_setting('t.d')::uuid, 'retry', 'HTTP 500');
select is((select status from notification_deliveries where id = current_setting('t.d')::uuid), 'dead',
  'depois de 5 tentativas vai para o dead-letter');

-- ---------------------------------------------------------------- Cota de mídia
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';
select results_eq($$ select allowed from assistant_take_quota('gemini-image', 1, 100) $$, $$ values (true) $$, 'foto conta na cota própria');

select * from finish();
rollback;
