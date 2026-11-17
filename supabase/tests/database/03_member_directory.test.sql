begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
select plan(3);

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.dev', 'authenticated', 'authenticated', '{"full_name":"Alice"}'),
  ('33333333-3333-3333-3333-333333333333', 'carol@test.dev', 'authenticated', 'authenticated', '{"full_name":"Carol"}');

set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev"}';
select set_config('test.hh', public.create_household('Casa')::text, false);

select is((select email from public.get_workspace_members(current_setting('test.hh')::uuid)), 'alice@test.dev',
  'membro lista e-mails dos membros');
select is((select is_owner from public.get_workspace_members(current_setting('test.hh')::uuid)), true,
  'indica a dona');

set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","email":"carol@test.dev"}';
select throws_ok($$ select * from public.get_workspace_members(current_setting('test.hh')::uuid) $$,
  '42501', 'Você não participa deste espaço', 'não-membro não lista e-mails');

reset role;
select * from finish();
rollback;
