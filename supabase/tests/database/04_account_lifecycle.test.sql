-- Transferência de posse e exclusão de conta.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
select plan(13);

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.dev', 'authenticated', 'authenticated', '{"full_name":"Alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.dev',   'authenticated', 'authenticated', '{"full_name":"Bob"}'),
  ('33333333-3333-3333-3333-333333333333', 'carol@test.dev', 'authenticated', 'authenticated', '{"full_name":"Carol"}');

-- Alice cria família, convida Bob; Alice cria também uma família só dela.
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';
select set_config('test.hh', public.create_household('Casa')::text, false);
select set_config('test.solo', public.create_household('Só minha')::text, false);
select set_config('test.token', public.create_workspace_invite(current_setting('test.hh')::uuid, 'bob@test.dev'), false);
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@test.dev"}';
select public.accept_workspace_invite(current_setting('test.token'));
-- Bob lança algo na família da Alice.
insert into transactions (id, workspace_id, kind, amount_cents, description, occurred_on, payment_method, member_user_id)
values ('aaaaaaaa-0000-0000-0000-0000000000b1', current_setting('test.hh')::uuid, 'expense', 1500, 'Padaria', '2026-11-10', 'pix',
        '22222222-2222-2222-2222-222222222222');

-- Bob (não-dono) não transfere.
select throws_ok($$ select public.transfer_workspace_ownership(current_setting('test.hh')::uuid, '22222222-2222-2222-2222-222222222222') $$,
  '42501', 'Apenas o dono pode transferir a posse', 'só o dono transfere');

-- Alice: bloqueada para excluir a conta.
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';
select is((select count(*)::int from public.get_account_deletion_blockers()), 1,
  'família com outro membro aparece como bloqueio (a família solo não)');
select throws_ok($$ select public.delete_my_account() $$, '42501', null,
  'dono de família com membros não exclui a conta');
select throws_ok($$ select public.transfer_workspace_ownership(current_setting('test.hh')::uuid, '33333333-3333-3333-3333-333333333333') $$,
  '22023', 'O novo dono precisa ser membro da família', 'não transfere para não-membro');
select throws_ok($$ update workspaces set owner_id = '22222222-2222-2222-2222-222222222222' where id = current_setting('test.hh')::uuid $$,
  '42501', null, 'owner_id continua imutável fora da RPC');

-- Transfere para Bob.
select lives_ok($$ select public.transfer_workspace_ownership(current_setting('test.hh')::uuid, '22222222-2222-2222-2222-222222222222') $$,
  'dono transfere a posse para um membro');
select is((select owner_id from workspaces where id = current_setting('test.hh')::uuid),
  '22222222-2222-2222-2222-222222222222'::uuid, 'Bob é o novo dono');
select is((select role::text from workspace_members where workspace_id = current_setting('test.hh')::uuid
           and user_id = '22222222-2222-2222-2222-222222222222'), 'admin', 'novo dono é admin');

-- Agora Alice pode sair do sistema.
select is((select count(*)::int from public.get_account_deletion_blockers()), 0, 'sem bloqueios após transferir');
select lives_ok($$ select public.delete_my_account() $$, 'Alice exclui a conta');

reset role;
select is((select count(*)::int from workspaces where owner_id = '11111111-1111-1111-1111-111111111111'), 0,
  'espaços da Alice (individual e família solo) foram apagados');
select is((select count(*)::int from workspace_members where workspace_id = current_setting('test.hh')::uuid), 1,
  'a família continua existindo só com o Bob');

-- Bob exclui a conta: transação dele em outra família fica anonimizada? Aqui a família é dele
-- e ele está sozinho → apagada. Testamos anonimização com Carol na família do Bob.
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@test.dev"}';
select set_config('test.token2', public.create_workspace_invite(current_setting('test.hh')::uuid, 'carol@test.dev'), false);
set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","email":"carol@test.dev"}';
select public.accept_workspace_invite(current_setting('test.token2'));
insert into transactions (id, workspace_id, kind, amount_cents, description, occurred_on, payment_method, member_user_id)
values ('aaaaaaaa-0000-0000-0000-0000000000c1', current_setting('test.hh')::uuid, 'expense', 900, 'Café', '2026-11-11', 'cash',
        '33333333-3333-3333-3333-333333333333');
select public.delete_my_account();
reset role;
select ok((select created_by is null and member_user_id is null from transactions
           where id = 'aaaaaaaa-0000-0000-0000-0000000000c1'),
  'lançamento da Carol na família do Bob fica anonimizado (não é apagado)');

select * from finish();
rollback;
