-- =============================================================================
-- 0009 · Fase 5: assistente (IA que entende mensagens).
-- -----------------------------------------------------------------------------
-- Decisões: ADR-0018 (a IA só interpreta; o domínio valida, calcula e grava) e
-- ADR-0019 (privacidade, cota e cadeia de provedores).
-- Tudo aqui é por USUÁRIO (histórico, estado da conversa, cota), exceto as
-- regras de categoria aprendidas, que valem para o espaço (família) inteiro.
-- =============================================================================

-- Origem "assistant" para lançamentos/aportes criados pelo assistente.
-- (Só usada em tempo de execução: valor novo de enum não pode ser usado nesta transação.)
alter type public.entry_source add value if not exists 'assistant';

-- -----------------------------------------------------------------------------
-- Histórico de conversa (por usuário; apagável)
-- -----------------------------------------------------------------------------
create table public.assistant_messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  channel      text not null default 'app' check (channel in ('app', 'whatsapp', 'telegram')),
  role         text not null check (role in ('user', 'assistant')),
  body         text not null check (char_length(body) between 1 and 4096),
  -- Cartões de confirmação, opções, ações executadas (para redesenhar a conversa).
  payload      jsonb,
  created_at   timestamptz not null default now()
);
create index assistant_messages_user_idx on public.assistant_messages (user_id, channel, created_at desc);

-- -----------------------------------------------------------------------------
-- Estado da conversa (aguardando confirmação / escolha), com expiração
-- -----------------------------------------------------------------------------
create table public.assistant_sessions (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  channel    text not null default 'app' check (channel in ('app', 'whatsapp', 'telegram')),
  state      jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  updated_at timestamptz not null default now(),
  primary key (user_id, channel)
);

-- -----------------------------------------------------------------------------
-- Ações executadas pelo assistente: origem + mensagem original (auditoria) e
-- base do "desfazer último".
-- -----------------------------------------------------------------------------
create table public.assistant_actions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  channel       text not null default 'app' check (channel in ('app', 'whatsapp', 'telegram')),
  -- Itens da MESMA mensagem ("30 no uber e 80 no mercado") são desfeitos juntos.
  batch_id      uuid not null,
  intent        text not null check (char_length(intent) <= 40),
  original_text text not null check (char_length(original_text) between 1 and 4096),
  record_table  text not null check (record_table in ('transactions', 'transfers', 'goal_contributions', 'installment_plans')),
  record_id     uuid not null,
  -- Para desfazer "confirmar previsto": só volta o status.
  undo_kind     text not null default 'delete' check (undo_kind in ('delete', 'unsettle', 'replan', 'delete_plan')),
  provider      text check (provider in ('local', 'gemini', 'groq', 'mock', 'form')),
  created_at    timestamptz not null default now(),
  undone_at     timestamptz
);
create index assistant_actions_user_idx on public.assistant_actions (user_id, created_at desc);
create index assistant_actions_batch_idx on public.assistant_actions (batch_id);

-- -----------------------------------------------------------------------------
-- Regras de categoria aprendidas ("padaria do zé" → Mercado), por espaço.
-- -----------------------------------------------------------------------------
create table public.category_rules (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- Texto normalizado (minúsculas, sem acento, sem valor/datas).
  pattern      text not null check (char_length(pattern) between 2 and 80),
  category_id  uuid not null,
  hits         integer not null default 0,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, pattern),
  foreign key (category_id, workspace_id) references public.categories (id, workspace_id) on delete cascade
);

-- -----------------------------------------------------------------------------
-- Cota de IA por usuário/dia/provedor (o parser local não consome cota).
-- -----------------------------------------------------------------------------
create table public.assistant_usage (
  user_id  uuid not null references auth.users (id) on delete cascade,
  day      date not null,
  provider text not null check (provider in ('gemini', 'groq')),
  calls    integer not null default 0,
  primary key (user_id, day, provider)
);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.assistant_messages enable row level security;
alter table public.assistant_sessions enable row level security;
alter table public.assistant_actions enable row level security;
alter table public.category_rules enable row level security;
alter table public.assistant_usage enable row level security;
revoke all on public.assistant_messages, public.assistant_sessions, public.assistant_actions,
              public.category_rules, public.assistant_usage from anon;
revoke truncate, references, trigger on public.assistant_messages, public.assistant_sessions,
              public.assistant_actions, public.category_rules, public.assistant_usage from authenticated;

-- Mensagens, sessão e ações: cada um só vê/mexe no que é seu.
create policy assistant_messages_own on public.assistant_messages for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (workspace_id is null or private.is_member(workspace_id)));
create policy assistant_sessions_own on public.assistant_sessions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy assistant_actions_select on public.assistant_actions for select to authenticated
  using (user_id = (select auth.uid()));
create policy assistant_actions_insert on public.assistant_actions for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_member(workspace_id));
create policy assistant_actions_update on public.assistant_actions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
-- Uso de cota: só leitura do próprio (gravação só pela função abaixo).
grant select on public.assistant_usage to authenticated;
revoke insert, update, delete on public.assistant_usage from authenticated;
create policy assistant_usage_select_own on public.assistant_usage for select to authenticated
  using (user_id = (select auth.uid()));

-- Regras de categoria: membros do espaço (como as categorias).
create policy category_rules_select on public.category_rules for select to authenticated
  using (workspace_id in (select private.my_workspace_ids()));
create policy category_rules_insert on public.category_rules for insert to authenticated
  with check (workspace_id in (select private.my_workspace_ids()));
create policy category_rules_update on public.category_rules for update to authenticated
  using (workspace_id in (select private.my_workspace_ids()))
  with check (workspace_id in (select private.my_workspace_ids()));
create policy category_rules_delete on public.category_rules for delete to authenticated
  using (workspace_id in (select private.my_workspace_ids()));

create trigger category_rules_created_by before insert on public.category_rules
  for each row execute function private.set_created_by();
create trigger category_rules_updated_at before update on public.category_rules
  for each row execute function private.set_updated_at();
create trigger assistant_sessions_updated_at before update on public.assistant_sessions
  for each row execute function private.set_updated_at();

-- Auditoria: a ação do assistente (com a MENSAGEM ORIGINAL) entra no audit_log
-- junto com o lançamento criado (que já é auditado e tem source = 'assistant').
create trigger assistant_actions_audit after insert or update on public.assistant_actions
  for each row execute function private.audit();
create trigger category_rules_audit after insert or update or delete on public.category_rules
  for each row execute function private.audit();

-- -----------------------------------------------------------------------------
-- Cota: chamada ATÔMICA "posso usar o provedor X agora?".
--   • limite por minuto (rate limit, por usuário, todos os provedores)
--   • limite por dia (por usuário e provedor)
-- Devolve allowed + quantas chamadas já foram feitas hoje.
-- -----------------------------------------------------------------------------
create or replace function public.assistant_take_quota(p_provider text, p_daily_limit int, p_per_minute int)
returns table (allowed boolean, used_today int, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_day date := private.today_sp();
  v_used int;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  if p_provider not in ('gemini', 'groq') then
    raise exception 'Provedor inválido' using errcode = '22023';
  end if;
  if not public.hit_rate_limit('assistant:' || v_uid::text, 60, greatest(1, p_per_minute)) then
    select coalesce(max(u.calls), 0) into v_used from public.assistant_usage u
     where u.user_id = v_uid and u.day = v_day and u.provider = p_provider;
    return query select false, v_used, 'rate_limit'::text;
    return;
  end if;
  if coalesce(p_daily_limit, 0) <= 0 then
    return query select false, 0, 'daily_limit'::text;
    return;
  end if;
  -- Atômico: só incrementa se ainda houver cota (duas abas ao mesmo tempo não passam do limite).
  insert into public.assistant_usage as u (user_id, day, provider, calls)
  values (v_uid, v_day, p_provider, 1)
  on conflict (user_id, day, provider) do update set calls = u.calls + 1
    where u.calls < p_daily_limit
  returning u.calls into v_used;
  if not found then
    select coalesce(max(x.calls), 0) into v_used from public.assistant_usage x
     where x.user_id = v_uid and x.day = v_day and x.provider = p_provider;
    return query select false, v_used, 'daily_limit'::text;
    return;
  end if;
  return query select true, v_used, null::text;
end;
$$;
revoke all on function public.assistant_take_quota(text, int, int) from public, anon;
grant execute on function public.assistant_take_quota(text, int, int) to authenticated;

-- Limpa sessões expiradas junto com o job diário de recorrências.
create or replace function private.cleanup_assistant()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.assistant_sessions where expires_at < now() - interval '1 day';
  delete from public.assistant_usage where day < private.today_sp() - 60;
$$;
revoke all on function private.cleanup_assistant() from public;
select cron.schedule('limpar-assistente', '30 6 * * *', $$ select private.cleanup_assistant() $$);
