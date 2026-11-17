-- =============================================================================
-- SEED · SOMENTE DESENVOLVIMENTO LOCAL (roda em `supabase db reset`).
-- NUNCA rode isto em produção.
--
-- Usuários de teste (e-mail já confirmado), senha de ambos: Teste12345
--   ana@teste.local    → dona da família "Casa Teste"
--   bruno@teste.local  → sem família (use para testar convites)
-- =============================================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'ana@teste.local', extensions.crypt('Teste12345', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Ana Teste"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'bruno@teste.local', extensions.crypt('Teste12345', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Bruno Teste"}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email in ('ana@teste.local', 'bruno@teste.local');

-- Família da Ana (o trigger adiciona a dona como admin e cria as categorias).
insert into public.workspaces (kind, name, owner_id)
values ('household', 'Casa Teste', 'a0000000-0000-4000-8000-000000000001');
