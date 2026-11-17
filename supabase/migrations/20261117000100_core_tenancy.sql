-- =============================================================================
-- 0001 · Núcleo de multi-tenancy
-- -----------------------------------------------------------------------------
-- Conceito central: WORKSPACE (espaço financeiro).
--   * kind = 'personal'  → espaço individual, criado automaticamente no cadastro.
--                          Só o dono participa. Nunca recebe convites.
--   * kind = 'household' → espaço familiar, criado por um usuário (dono/admin),
--                          que convida membros.
-- TODOS os dados financeiros referenciam workspace_id. O isolamento é garantido
-- por Row Level Security (RLS) usando os helpers do schema `private`.
-- =============================================================================

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Schema `private`: NÃO é exposto pela API REST (PostgREST só expõe `public`).
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.workspace_kind as enum ('personal', 'household');
create type public.member_role as enum ('admin', 'member');

-- -----------------------------------------------------------------------------
-- Funções utilitárias genéricas (triggers)
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Impede alteração de colunas que definem posse/isolamento.
-- Uso: create trigger ... before update ... execute function private.protect_ownership_columns();
create or replace function private.protect_ownership_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb := to_jsonb(old);
  v_col text;
begin
  foreach v_col in array array['workspace_id', 'created_by', 'created_at', 'owner_id'] loop
    if v_old ? v_col and (v_new -> v_col) is distinct from (v_old -> v_col) then
      -- created_by pode virar NULL quando o usuário é excluído (ON DELETE SET NULL)
      if v_col = 'created_by' and (v_new -> v_col) = 'null'::jsonb then
        continue;
      end if;
      raise exception 'A coluna % não pode ser alterada', v_col
        using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;

-- Em INSERT feito por usuário autenticado, created_by é SEMPRE o próprio usuário
-- (impede "forjar" autoria). Chamadas com service_role (bot) mantêm o valor informado.
create or replace function private.set_created_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles (1:1 com auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  full_name         text not null default '' check (char_length(full_name) <= 120),
  avatar_url        text check (avatar_url is null or char_length(avatar_url) <= 500),
  last_workspace_id uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.profiles is 'Dados públicos do usuário (nome, avatar) e preferências.';
comment on column public.profiles.last_workspace_id is 'Último espaço ativo (alternância individual/família).';

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- workspaces
-- -----------------------------------------------------------------------------
create table public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  kind       public.workspace_kind not null,
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  currency   char(3) not null default 'BRL' check (currency = 'BRL'),
  timezone   text not null default 'America/Sao_Paulo' check (timezone = 'America/Sao_Paulo'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.workspaces is 'Espaço financeiro: individual (personal) ou familiar (household).';

-- Cada usuário tem exatamente UM espaço pessoal.
create unique index workspaces_one_personal_per_owner
  on public.workspaces (owner_id) where kind = 'personal';
create index workspaces_owner_idx on public.workspaces (owner_id);

alter table public.profiles
  add constraint profiles_last_workspace_fk
  foreign key (last_workspace_id) references public.workspaces (id) on delete set null;

create trigger workspaces_updated_at before update on public.workspaces
  for each row execute function private.set_updated_at();
create trigger workspaces_protect before update on public.workspaces
  for each row execute function private.protect_ownership_columns();

-- kind também é imutável
create or replace function private.workspaces_kind_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind is distinct from old.kind then
    raise exception 'O tipo do espaço não pode ser alterado' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger workspaces_kind_immutable before update on public.workspaces
  for each row execute function private.workspaces_kind_immutable();

-- -----------------------------------------------------------------------------
-- workspace_members
-- -----------------------------------------------------------------------------
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         public.member_role not null default 'member',
  joined_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
comment on table public.workspace_members is 'Quem participa de cada espaço e com qual papel.';
create index workspace_members_user_idx on public.workspace_members (user_id);

-- -----------------------------------------------------------------------------
-- Helpers de autorização (SECURITY DEFINER → ignoram RLS, evitando recursão).
-- Sempre com search_path vazio e nomes totalmente qualificados.
-- -----------------------------------------------------------------------------
create or replace function private.my_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.workspace_id
  from public.workspace_members m
  where m.user_id = (select auth.uid());
$$;

create or replace function private.is_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_admin(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = (select auth.uid())
      and m.role = 'admin'
  );
$$;

create or replace function private.workspace_owner(p_workspace_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select w.owner_id from public.workspaces w where w.id = p_workspace_id;
$$;

-- Verdadeiro se o usuário (p_user_id) é membro do espaço. Útil para validar
-- colunas como member_user_id / owner_user_id.
create or replace function private.user_is_member(p_workspace_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = p_user_id
  );
$$;

revoke all on function private.my_workspace_ids() from public;
revoke all on function private.is_member(uuid) from public;
revoke all on function private.is_admin(uuid) from public;
revoke all on function private.workspace_owner(uuid) from public;
revoke all on function private.user_is_member(uuid, uuid) from public;
grant execute on function private.my_workspace_ids() to authenticated, service_role;
grant execute on function private.is_member(uuid) to authenticated, service_role;
grant execute on function private.is_admin(uuid) to authenticated, service_role;
grant execute on function private.workspace_owner(uuid) to authenticated, service_role;
grant execute on function private.user_is_member(uuid, uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Invariantes de membros (triggers)
-- -----------------------------------------------------------------------------
-- 1) Ao criar um workspace, o dono entra automaticamente como admin.
create or replace function private.add_owner_as_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'admin');
  return new;
end;
$$;
create trigger workspaces_add_owner after insert on public.workspaces
  for each row execute function private.add_owner_as_admin();

-- 2) Espaço pessoal só tem o dono. 3) O dono é sempre admin e não pode ser removido.
create or replace function private.guard_workspace_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ws public.workspaces%rowtype;
begin
  if tg_op = 'DELETE' then
    select * into v_ws from public.workspaces where id = old.workspace_id;
    -- Se o próprio workspace está sendo apagado (cascade), v_ws não existe mais.
    if found and old.user_id = v_ws.owner_id then
      raise exception 'O dono não pode ser removido do espaço' using errcode = '42501';
    end if;
    return old;
  end if;

  select * into v_ws from public.workspaces where id = new.workspace_id;

  if tg_op = 'INSERT' then
    if v_ws.kind = 'personal' and new.user_id <> v_ws.owner_id then
      raise exception 'Espaços pessoais não aceitam outros membros' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.workspace_id <> old.workspace_id or new.user_id <> old.user_id then
      raise exception 'Vínculo de membro não pode ser movido' using errcode = '42501';
    end if;
    if new.user_id = v_ws.owner_id and new.role <> 'admin' then
      raise exception 'O dono precisa continuar como administrador' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
create trigger workspace_members_guard
  before insert or update or delete on public.workspace_members
  for each row execute function private.guard_workspace_members();

-- -----------------------------------------------------------------------------
-- workspace_invites
-- -----------------------------------------------------------------------------
create table public.workspace_invites (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email        extensions.citext not null check (char_length(email) <= 254),
  role         public.member_role not null default 'member',
  -- Guardamos só o HASH (sha256) do token. O token em texto puro existe apenas
  -- no link enviado ao convidado.
  token_hash   bytea not null unique,
  invited_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users (id) on delete set null,
  revoked_at   timestamptz,
  check (not (accepted_at is not null and revoked_at is not null))
);
comment on table public.workspace_invites is 'Convites para espaços familiares (token de uso único, só o hash é salvo).';

create unique index workspace_invites_one_pending
  on public.workspace_invites (workspace_id, email)
  where accepted_at is null and revoked_at is null;
create index workspace_invites_ws_idx on public.workspace_invites (workspace_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;

-- Privilégios de tabela (defesa em profundidade, além da RLS).
revoke all on public.profiles, public.workspaces, public.workspace_members, public.workspace_invites from anon;
revoke insert, update, delete, truncate, references, trigger on public.profiles from authenticated;
revoke insert, update, truncate, references, trigger on public.workspaces from authenticated;
revoke insert, update, truncate, references, trigger on public.workspace_members from authenticated;
revoke all on public.workspace_invites from authenticated;

grant update (full_name, avatar_url, last_workspace_id) on public.profiles to authenticated;
grant update (name) on public.workspaces to authenticated;
grant update (role) on public.workspace_members to authenticated;
-- token_hash nunca é legível pelo cliente.
grant select (id, workspace_id, email, role, invited_by, created_at, expires_at, accepted_at, accepted_by, revoked_at)
  on public.workspace_invites to authenticated;
grant update (revoked_at) on public.workspace_invites to authenticated;

-- profiles: vejo o meu e o de quem divide algum espaço comigo.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.workspace_members m
      where m.user_id = profiles.id
        and m.workspace_id in (select private.my_workspace_ids())
    )
  );

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and (last_workspace_id is null or private.is_member(last_workspace_id))
  );

-- workspaces
create policy workspaces_select on public.workspaces
  for select to authenticated
  using (id in (select private.my_workspace_ids()));

create policy workspaces_update_admin on public.workspaces
  for update to authenticated
  using (private.is_admin(id))
  with check (private.is_admin(id));

-- Só o dono exclui, e só espaço familiar (o pessoal é eterno enquanto a conta existir).
create policy workspaces_delete_owner on public.workspaces
  for delete to authenticated
  using (owner_id = (select auth.uid()) and kind = 'household');

-- workspace_members
create policy members_select on public.workspace_members
  for select to authenticated
  using (workspace_id in (select private.my_workspace_ids()));

-- Admin altera papel de outros (o trigger impede rebaixar o dono).
create policy members_update_admin on public.workspace_members
  for update to authenticated
  using (private.is_admin(workspace_id) and user_id <> (select auth.uid()))
  with check (private.is_admin(workspace_id));

-- Admin remove outros; qualquer membro pode SAIR (remover a si mesmo).
-- O dono nunca é removido (trigger).
create policy members_delete on public.workspace_members
  for delete to authenticated
  using (
    workspace_id in (select private.my_workspace_ids())
    and (private.is_admin(workspace_id) or user_id = (select auth.uid()))
  );

-- workspace_invites: só admins veem e revogam.
create policy invites_select_admin on public.workspace_invites
  for select to authenticated
  using (private.is_admin(workspace_id));

create policy invites_revoke_admin on public.workspace_invites
  for update to authenticated
  using (private.is_admin(workspace_id) and accepted_at is null)
  with check (private.is_admin(workspace_id));

-- =============================================================================
-- RPCs (chamadas via supabase.rpc). SECURITY DEFINER com checagens explícitas.
-- =============================================================================

-- Cadastro: cria profile + espaço pessoal (o trigger adiciona o dono como admin).
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ws_id uuid;
  v_name text := left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), ''), 120);
begin
  insert into public.profiles (id, full_name) values (new.id, v_name);

  insert into public.workspaces (kind, name, owner_id)
  values ('personal', 'Pessoal', new.id)
  returning id into v_ws_id;

  update public.profiles set last_workspace_id = v_ws_id where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Criar família
create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ws_id uuid;
  v_count int;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then
    raise exception 'Nome inválido (1 a 80 caracteres)' using errcode = '22023';
  end if;

  select count(*) into v_count
  from public.workspaces where owner_id = v_uid and kind = 'household';
  if v_count >= 5 then
    raise exception 'Limite de 5 famílias por usuário atingido' using errcode = '54000';
  end if;

  insert into public.workspaces (kind, name, owner_id)
  values ('household', btrim(p_name), v_uid)
  returning id into v_ws_id;

  update public.profiles set last_workspace_id = v_ws_id where id = v_uid;
  return v_ws_id;
end;
$$;

-- Criar convite. Retorna o TOKEN EM TEXTO (única vez em que ele existe).
create or replace function public.create_workspace_invite(
  p_workspace_id uuid,
  p_email text,
  p_role public.member_role default 'member'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email extensions.citext := lower(btrim(p_email));
  v_kind public.workspace_kind;
  v_token text;
  v_pending int;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  if not private.is_admin(p_workspace_id) then
    raise exception 'Apenas administradores podem convidar' using errcode = '42501';
  end if;

  select kind into v_kind from public.workspaces where id = p_workspace_id;
  if v_kind is distinct from 'household' then
    raise exception 'Convites só existem em espaços familiares' using errcode = '22023';
  end if;

  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'E-mail inválido' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.workspace_members m
    join auth.users u on u.id = m.user_id
    where m.workspace_id = p_workspace_id and lower(u.email) = v_email
  ) then
    raise exception 'Essa pessoa já é membro deste espaço' using errcode = '23505';
  end if;

  select count(*) into v_pending
  from public.workspace_invites
  where workspace_id = p_workspace_id and accepted_at is null and revoked_at is null and expires_at > now();
  if v_pending >= 20 then
    raise exception 'Muitos convites pendentes' using errcode = '54000';
  end if;

  -- Substitui convite pendente anterior para o mesmo e-mail.
  update public.workspace_invites
     set revoked_at = now()
   where workspace_id = p_workspace_id and email = v_email
     and accepted_at is null and revoked_at is null;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.workspace_invites (workspace_id, email, role, token_hash, invited_by)
  values (p_workspace_id, v_email, p_role, extensions.digest(v_token, 'sha256'), v_uid);

  return v_token;
end;
$$;

-- Prévia do convite (para a tela de aceite). Exige estar logado.
create or replace function public.get_invite_preview(p_token text)
returns table (
  workspace_name text,
  inviter_name text,
  invited_email text,
  role public.member_role,
  status text,
  email_matches boolean,
  already_member boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_inv public.workspace_invites%rowtype;
  v_my_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  select * into v_inv
  from public.workspace_invites i
  where i.token_hash = extensions.digest(p_token, 'sha256');

  if not found then
    return;
  end if;

  return query
  select
    w.name,
    coalesce(nullif(p.full_name, ''), 'Um administrador'),
    v_inv.email::text,
    v_inv.role,
    case
      when v_inv.accepted_at is not null then 'accepted'
      when v_inv.revoked_at is not null then 'revoked'
      when v_inv.expires_at <= now() then 'expired'
      else 'pending'
    end,
    v_inv.email::text = v_my_email,
    private.is_member(v_inv.workspace_id)
  from public.workspaces w
  left join public.profiles p on p.id = v_inv.invited_by
  where w.id = v_inv.workspace_id;
end;
$$;

-- Aceitar convite: o e-mail da sessão precisa ser o mesmo do convite.
create or replace function public.accept_workspace_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_my_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_inv public.workspace_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Convite inválido' using errcode = '22023';
  end if;

  select * into v_inv
  from public.workspace_invites
  where token_hash = extensions.digest(p_token, 'sha256')
  for update;

  if not found or v_inv.revoked_at is not null then
    raise exception 'Convite inválido ou revogado' using errcode = '22023';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'Este convite já foi usado' using errcode = '22023';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'Este convite expirou' using errcode = '22023';
  end if;
  if v_inv.email::text <> v_my_email then
    raise exception 'Este convite foi enviado para outro e-mail' using errcode = '42501';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_inv.workspace_id, v_uid, v_inv.role)
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invites
     set accepted_at = now(), accepted_by = v_uid
   where id = v_inv.id;

  update public.profiles set last_workspace_id = v_inv.workspace_id where id = v_uid;

  return v_inv.workspace_id;
end;
$$;

-- RPCs: só usuários autenticados executam.
revoke all on function public.create_household(text) from public, anon;
revoke all on function public.create_workspace_invite(uuid, text, public.member_role) from public, anon;
revoke all on function public.get_invite_preview(text) from public, anon;
revoke all on function public.accept_workspace_invite(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.create_workspace_invite(uuid, text, public.member_role) to authenticated;
grant execute on function public.get_invite_preview(text) to authenticated;
grant execute on function public.accept_workspace_invite(text) to authenticated;

-- Triggers internos não devem ser chamáveis via API.
revoke all on function private.handle_new_user() from public;
revoke all on function private.add_owner_as_admin() from public;
revoke all on function private.guard_workspace_members() from public;
