-- =============================================================================
-- 0003 · Canais de mensagem (WhatsApp / Telegram)
-- -----------------------------------------------------------------------------
-- O webhook do bot roda no servidor com a service_role (ignora RLS). Por isso:
--   * O vínculo número ↔ usuário só é criado após validar um código de uso
--     único gerado no painel (hash salvo, expira em 10 min).
--   * O código da aplicação SEMPRE resolve o usuário pelo vínculo e confere
--     se ele é membro do workspace antes de gravar (ver ADR-0004).
-- =============================================================================

create type public.channel_kind as enum ('whatsapp', 'telegram');
create type public.message_direction as enum ('in', 'out');

-- Vínculo de um número/chat com um usuário.
create table public.channel_links (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  channel              public.channel_kind not null,
  -- WhatsApp: telefone E.164 sem '+'; Telegram: chat_id.
  external_id          text not null check (external_id ~ '^[0-9-]{5,32}$'),
  display_label        text check (char_length(display_label) <= 60),
  -- Em qual espaço os lançamentos por mensagem caem por padrão.
  default_workspace_id uuid references public.workspaces (id) on delete set null,
  verified_at          timestamptz not null default now(),
  last_message_at      timestamptz,
  created_at           timestamptz not null default now(),
  unique (channel, external_id)
);
create index channel_links_user_idx on public.channel_links (user_id);

-- Códigos de vinculação (o usuário gera no painel e envia ao bot).
create table public.channel_link_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  channel     public.channel_kind not null,
  code_hash   bytea not null unique,
  expires_at  timestamptz not null default (now() + interval '10 minutes'),
  consumed_at timestamptz,
  attempts    smallint not null default 0,
  created_at  timestamptz not null default now()
);
create index channel_link_codes_user_idx on public.channel_link_codes (user_id, created_at desc);

-- Log de mensagens: idempotência (o provedor reenvia webhooks), auditoria e "desfazer".
create table public.bot_messages (
  id                   uuid primary key default gen_random_uuid(),
  channel              public.channel_kind not null,
  external_message_id  text not null check (char_length(external_message_id) <= 200),
  link_id              uuid references public.channel_links (id) on delete set null,
  user_id              uuid references auth.users (id) on delete cascade,
  workspace_id         uuid references public.workspaces (id) on delete cascade,
  direction            public.message_direction not null,
  body                 text check (char_length(body) <= 4096),
  -- Resultado estruturado da IA (intent, valores, confiança...).
  parsed               jsonb,
  transaction_id       uuid references public.transactions (id) on delete set null,
  goal_contribution_id uuid references public.goal_contributions (id) on delete set null,
  undone_at            timestamptz,
  created_at           timestamptz not null default now(),
  unique (channel, external_message_id)
);
create index bot_messages_user_idx on public.bot_messages (user_id, created_at desc);

-- Estado de conversa (perguntas de esclarecimento pendentes). Só o servidor usa.
create table public.bot_sessions (
  link_id    uuid primary key references public.channel_links (id) on delete cascade,
  state      jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  updated_at timestamptz not null default now()
);

-- Limite de taxa simples em Postgres (janela fixa). Evita custo extra (Redis).
create table public.rate_limits (
  key          text not null check (char_length(key) <= 200),
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (key, window_start)
);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.channel_links enable row level security;
alter table public.channel_link_codes enable row level security;
alter table public.bot_messages enable row level security;
alter table public.bot_sessions enable row level security;
alter table public.rate_limits enable row level security;

revoke all on public.channel_links, public.channel_link_codes, public.bot_messages,
              public.bot_sessions, public.rate_limits from anon, authenticated;

-- channel_links: o usuário vê, troca o espaço padrão e remove os próprios vínculos.
grant select, delete on public.channel_links to authenticated;
grant update (default_workspace_id, display_label) on public.channel_links to authenticated;

create policy channel_links_select_own on public.channel_links
  for select to authenticated using (user_id = (select auth.uid()));
create policy channel_links_update_own on public.channel_links
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
              and (default_workspace_id is null or private.is_member(default_workspace_id)));
create policy channel_links_delete_own on public.channel_links
  for delete to authenticated using (user_id = (select auth.uid()));

-- bot_messages: leitura do próprio histórico.
grant select on public.bot_messages to authenticated;
create policy bot_messages_select_own on public.bot_messages
  for select to authenticated using (user_id = (select auth.uid()));

-- channel_link_codes, bot_sessions, rate_limits: sem acesso de cliente (sem policies).

-- -----------------------------------------------------------------------------
-- RPC: gerar código de vinculação (retorna o código em texto UMA vez).
-- -----------------------------------------------------------------------------
create or replace function public.create_channel_link_code(p_channel public.channel_kind)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_recent int;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  select count(*) into v_recent
  from public.channel_link_codes
  where user_id = v_uid and created_at > now() - interval '1 hour';
  if v_recent >= 10 then
    raise exception 'Muitos códigos gerados. Tente novamente mais tarde.' using errcode = '54000';
  end if;

  -- Invalida códigos anteriores ainda não usados.
  update public.channel_link_codes
     set consumed_at = now()
   where user_id = v_uid and channel = p_channel and consumed_at is null;

  -- 8 caracteres de um alfabeto sem ambiguidades (sem 0/O, 1/I/L).
  select string_agg(substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', (get_byte(b, i) % 31) + 1, 1), '')
    into v_code
  from (select extensions.gen_random_bytes(8) as b) r, generate_series(0, 7) as i;

  insert into public.channel_link_codes (user_id, channel, code_hash)
  values (v_uid, p_channel, extensions.digest(v_code, 'sha256'));

  return v_code;
end;
$$;

revoke all on function public.create_channel_link_code(public.channel_kind) from public, anon;
grant execute on function public.create_channel_link_code(public.channel_kind) to authenticated;

-- -----------------------------------------------------------------------------
-- RPC de servidor: consumir código e criar vínculo. SÓ service_role.
-- -----------------------------------------------------------------------------
create or replace function public.consume_channel_link_code(
  p_channel public.channel_kind,
  p_code text,
  p_external_id text,
  p_display_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code public.channel_link_codes%rowtype;
  v_link_id uuid;
  v_personal uuid;
begin
  select * into v_code
  from public.channel_link_codes
  where code_hash = extensions.digest(upper(btrim(p_code)), 'sha256')
    and channel = p_channel
  for update;

  if not found or v_code.consumed_at is not null or v_code.expires_at <= now() then
    return null;
  end if;

  update public.channel_link_codes set consumed_at = now() where id = v_code.id;

  select id into v_personal from public.workspaces
  where owner_id = v_code.user_id and kind = 'personal';

  insert into public.channel_links (user_id, channel, external_id, display_label, default_workspace_id)
  values (v_code.user_id, p_channel, p_external_id, p_display_label, v_personal)
  on conflict (channel, external_id) do update
    set user_id = excluded.user_id,
        display_label = excluded.display_label,
        default_workspace_id = excluded.default_workspace_id,
        verified_at = now()
  returning id into v_link_id;

  return v_link_id;
end;
$$;

revoke all on function public.consume_channel_link_code(public.channel_kind, text, text, text) from public, anon, authenticated;
grant execute on function public.consume_channel_link_code(public.channel_kind, text, text, text) to service_role;

-- Rate limit atômico (janela fixa). SÓ service_role.
create or replace function public.hit_rate_limit(p_key text, p_window_seconds int, p_max int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count int;
begin
  insert into public.rate_limits (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_count;

  -- Limpeza oportunista de janelas antigas.
  delete from public.rate_limits where window_start < now() - interval '1 day';

  return v_count <= p_max;
end;
$$;

revoke all on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;
