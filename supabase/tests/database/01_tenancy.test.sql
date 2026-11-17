-- Testes de isolamento: cadastro, espaços, convites e papéis.
-- Rodar com: pnpm test:db   (equivale a `supabase test db`)
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(34);

-- -----------------------------------------------------------------------------
-- Fixtures: três usuários (Alice = dona da família, Bob = cônjuge, Carol = estranha)
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.dev', 'authenticated', 'authenticated', '{"full_name":"Alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.dev',   'authenticated', 'authenticated', '{"full_name":"Bob"}'),
  ('33333333-3333-3333-3333-333333333333', 'carol@test.dev', 'authenticated', 'authenticated', '{"full_name":"Carol"}');

-- 1-4: o cadastro cria profile + espaço pessoal + membro admin + categorias padrão
select is((select full_name from profiles where id = '11111111-1111-1111-1111-111111111111'), 'Alice',
  'cadastro cria profile com o nome');
select is((select count(*)::int from workspaces where owner_id = '11111111-1111-1111-1111-111111111111' and kind = 'personal'), 1,
  'cadastro cria exatamente um espaço pessoal');
select is((select role::text from workspace_members m join workspaces w on w.id = m.workspace_id
           where w.owner_id = '11111111-1111-1111-1111-111111111111' and w.kind = 'personal'), 'admin',
  'dono entra como admin do espaço pessoal');
select is((select count(*)::int from categories c join workspaces w on w.id = c.workspace_id
           where w.owner_id = '11111111-1111-1111-1111-111111111111'), 22,
  'espaço pessoal recebe as 22 categorias padrão');

-- -----------------------------------------------------------------------------
-- Como Alice
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev","role":"authenticated"}';

select is((select count(*)::int from workspaces), 1, 'Alice só vê o próprio espaço');
select is((select count(*)::int from profiles), 1, 'Alice só vê o próprio profile');

select set_config('test.hh', public.create_household('Família Teste')::text, false);
select is((select kind::text from workspaces where id = current_setting('test.hh')::uuid), 'household',
  'Alice cria um espaço familiar');
select is((select role::text from workspace_members
           where workspace_id = current_setting('test.hh')::uuid
             and user_id = '11111111-1111-1111-1111-111111111111'), 'admin',
  'criadora da família é admin');

select throws_ok(
  $$ select public.create_workspace_invite(
       (select id from workspaces where kind = 'personal'), 'bob@test.dev') $$,
  '22023', 'Convites só existem em espaços familiares',
  'espaço pessoal não aceita convites');

select throws_ok(
  $$ select public.create_workspace_invite(current_setting('test.hh')::uuid, 'nao-e-email') $$,
  '22023', 'E-mail inválido', 'e-mail inválido é rejeitado');

select set_config('test.token',
  public.create_workspace_invite(current_setting('test.hh')::uuid, 'Bob@Test.dev'), false);
select ok(current_setting('test.token') ~ '^[0-9a-f]{64}$', 'convite retorna token de 64 hex');
select is((select email::text from workspace_invites where workspace_id = current_setting('test.hh')::uuid),
  'bob@test.dev', 'e-mail do convite é normalizado');

select throws_ok(
  $$ select token_hash from workspace_invites $$,
  '42501', null, 'token_hash não é legível pelo cliente');

delete from workspaces where kind = 'personal';
select is((select count(*)::int from workspaces where kind = 'personal'), 1,
  'espaço pessoal não pode ser excluído');

-- -----------------------------------------------------------------------------
-- Como Carol (estranha)
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","email":"carol@test.dev","role":"authenticated"}';

select is((select count(*)::int from workspaces where id = current_setting('test.hh')::uuid), 0,
  'Carol não vê a família');
select is((select count(*)::int from categories where workspace_id = current_setting('test.hh')::uuid), 0,
  'Carol não vê categorias da família');
select is((select email_matches from public.get_invite_preview(current_setting('test.token'))), false,
  'prévia indica que o convite não é para Carol');
select throws_ok(
  $$ select public.accept_workspace_invite(current_setting('test.token')) $$,
  '42501', 'Este convite foi enviado para outro e-mail',
  'Carol não consegue usar o convite do Bob');
select throws_ok(
  $$ select public.create_workspace_invite(current_setting('test.hh')::uuid, 'x@test.dev') $$,
  '42501', 'Apenas administradores podem convidar',
  'não-membro não convida');

-- -----------------------------------------------------------------------------
-- Como Bob (convidado)
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@test.dev","role":"authenticated"}';

select is((select status from public.get_invite_preview(current_setting('test.token'))), 'pending',
  'Bob vê o convite pendente');
select is(public.accept_workspace_invite(current_setting('test.token')), current_setting('test.hh')::uuid,
  'Bob aceita o convite');
select throws_ok(
  $$ select public.accept_workspace_invite(current_setting('test.token')) $$,
  '22023', 'Este convite já foi usado', 'convite é de uso único');

select is((select count(*)::int from workspaces), 2, 'Bob vê o espaço pessoal + a família');
select is((select count(*)::int from profiles), 2, 'Bob vê o próprio profile e o da Alice');
select throws_ok(
  $$ select public.create_workspace_invite(current_setting('test.hh')::uuid, 'x@test.dev') $$,
  '42501', 'Apenas administradores podem convidar', 'membro comum não convida');

-- Bob tenta se promover / renomear a família / remover a dona: nada acontece.
update workspace_members set role = 'admin'
 where workspace_id = current_setting('test.hh')::uuid and user_id = '22222222-2222-2222-2222-222222222222';
update workspaces set name = 'Hackeado' where id = current_setting('test.hh')::uuid;
delete from workspace_members
 where workspace_id = current_setting('test.hh')::uuid and user_id = '11111111-1111-1111-1111-111111111111';

reset role;
select is((select role::text from workspace_members
           where workspace_id = current_setting('test.hh')::uuid and user_id = '22222222-2222-2222-2222-222222222222'),
  'member', 'membro não se promove a admin');
select is((select name from workspaces where id = current_setting('test.hh')::uuid), 'Família Teste',
  'membro não renomeia a família');
select is((select count(*)::int from workspace_members
           where workspace_id = current_setting('test.hh')::uuid and user_id = '11111111-1111-1111-1111-111111111111'),
  1, 'membro não remove a dona');

-- Alice (admin) tenta rebaixar a si mesma via owner → trigger impede.
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev","role":"authenticated"}';
select throws_ok(
  $$ delete from workspace_members
      where workspace_id = current_setting('test.hh')::uuid
        and user_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', 'O dono não pode ser removido do espaço', 'dona não pode sair/ser removida');

-- Bob sai da família.
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@test.dev","role":"authenticated"}';
delete from workspace_members
 where workspace_id = current_setting('test.hh')::uuid and user_id = '22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from workspaces where id = current_setting('test.hh')::uuid), 0,
  'depois de sair, Bob não vê mais a família');

-- Dona exclui a família: cascata remove membros sem esbarrar no trigger do dono.
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@test.dev","role":"authenticated"}';
delete from workspaces where id = current_setting('test.hh')::uuid;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@test.dev","role":"authenticated"}';
select is((select count(*)::int from workspaces where id = current_setting('test.hh')::uuid), 1,
  'ex-membro não exclui a família');
select lives_ok($$ delete from workspaces where id = current_setting('test.hh')::uuid $$,
  'dona exclui a família');
reset role;
select is((select count(*)::int from workspace_members where workspace_id = current_setting('test.hh')::uuid), 0,
  'membros e dados da família somem em cascata');

-- anon não enxerga nada
reset role;
set local role anon;
select throws_ok($$ select * from workspaces $$, '42501', null, 'anon não acessa workspaces');

reset role;
select * from finish();
rollback;
