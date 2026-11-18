-- =============================================================================
-- 0010 · Fase 6: Telegram, fotos/áudio e notificações (Lar+).
-- -----------------------------------------------------------------------------
-- Decisões: ADR-0020 (produção: EasyPanel/Docker + CSP), ADR-0021 (só Telegram),
-- ADR-0022 (fotos e áudio: a IA só extrai; nada de arquivo guardado),
-- ADR-0023 (notificações: fila no banco + pg_cron + dispatcher protegido).
-- =============================================================================

create extension if not exists pg_net with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. Auditoria: de onde veio a mensagem (texto, foto, áudio).
--    A mensagem original de foto/áudio é a EXTRAÇÃO/TRANSCRIÇÃO, nunca o arquivo.
-- -----------------------------------------------------------------------------
alter table public.assistant_actions
  add column input_kind text not null default 'text' check (input_kind in ('text', 'photo', 'audio'));
alter table public.assistant_messages
  add column input_kind text not null default 'text' check (input_kind in ('text', 'photo', 'audio'));

-- -----------------------------------------------------------------------------
-- 2. Cota: imagem e áudio contam separado (limites próprios por dia).
-- -----------------------------------------------------------------------------
alter table public.assistant_usage drop constraint assistant_usage_provider_check;
alter table public.assistant_usage add constraint assistant_usage_provider_check
  check (provider in ('gemini', 'groq', 'gemini-image', 'groq-audio', 'gemini-audio'));

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
  if p_provider not in ('gemini', 'groq', 'gemini-image', 'groq-audio', 'gemini-audio') then
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

-- -----------------------------------------------------------------------------
-- 3. Telegram: um chat por usuário; idempotência por update_id; dead-letter.
-- -----------------------------------------------------------------------------
-- Vincular de novo (outro chat) substitui o vínculo anterior do mesmo usuário.
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
    -- Conta tentativa (código errado/expirado não revela nada).
    if found then
      update public.channel_link_codes set attempts = attempts + 1 where id = v_code.id;
    end if;
    return null;
  end if;

  update public.channel_link_codes set consumed_at = now() where id = v_code.id;

  select id into v_personal from public.workspaces
  where owner_id = v_code.user_id and kind = 'personal';

  -- Um chat por usuário: remove vínculos anteriores do mesmo usuário neste canal.
  delete from public.channel_links
   where user_id = v_code.user_id and channel = p_channel and external_id <> p_external_id;

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

-- O Telegram reenvia o mesmo update se não receber 200 rápido → idempotência.
-- Só o servidor (service_role) usa esta tabela; nenhum conteúdo de mensagem é guardado aqui.
create table public.telegram_updates (
  update_id    bigint primary key,
  chat_id      bigint,
  kind         text not null check (kind in ('text', 'photo', 'voice', 'callback', 'command', 'other')),
  status       text not null default 'received' check (status in ('received', 'processing', 'done', 'failed', 'dead', 'ignored')),
  attempts     smallint not null default 0,
  last_error   text check (char_length(last_error) <= 500),
  received_at  timestamptz not null default now(),
  finished_at  timestamptz
);
create index telegram_updates_status_idx on public.telegram_updates (status, received_at) where status in ('failed', 'dead');
alter table public.telegram_updates enable row level security;
revoke all on public.telegram_updates from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Notificações
-- -----------------------------------------------------------------------------
-- Tipos: conta vencendo amanhã, fatura fechando/vencendo, resumo semanal, meta
-- atingida, aporte planejado do dia, categoria acima da média, lançamento de
-- outro membro (opcional, desligado por padrão).
create table public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint        text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh          text not null check (char_length(p256dh) between 20 and 200),
  auth            text not null check (char_length(auth) between 8 and 100),
  device_label    text check (char_length(device_label) <= 80),
  created_at      timestamptz not null default now(),
  last_success_at timestamptz,
  failures        smallint not null default 0
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.notification_settings (
  user_id       uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  quiet_enabled boolean not null default true,
  quiet_start   time not null default '22:00',
  quiet_end     time not null default '07:00',
  updated_at    timestamptz not null default now()
);

create table public.notification_prefs (
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind     text not null check (kind in ('bill_due', 'invoice_closing', 'invoice_due', 'weekly_summary',
                                         'goal_achieved', 'planned_contribution', 'category_above_avg', 'member_entry')),
  enabled  boolean not null default true,
  push     boolean not null default true,
  telegram boolean not null default true,
  primary key (user_id, kind)
);

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  kind         text not null,
  -- Chave do evento: o MESMO evento nunca gera duas notificações para a mesma pessoa.
  event_key    text not null check (char_length(event_key) <= 200),
  title        text not null check (char_length(title) between 1 and 120),
  body         text not null check (char_length(body) between 1 and 400),
  url          text not null default '/painel' check (url ~ '^/' and char_length(url) <= 300),
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  unique (user_id, event_key)
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- Fila de envio (push/telegram) com retentativas e dead-letter.
create table public.notification_deliveries (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  channel         text not null check (channel in ('push', 'telegram')),
  status          text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'skipped', 'dead')),
  attempts        smallint not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error      text check (char_length(last_error) <= 500),
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  unique (notification_id, channel)
);
create index notification_deliveries_due_idx on public.notification_deliveries (next_attempt_at) where status in ('pending', 'sending');

alter table public.push_subscriptions enable row level security;
alter table public.notification_settings enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;
revoke all on public.push_subscriptions, public.notification_settings, public.notification_prefs,
              public.notifications, public.notification_deliveries from anon;
revoke all on public.notification_deliveries from authenticated;
revoke truncate, references, trigger on public.push_subscriptions, public.notification_settings,
              public.notification_prefs, public.notifications from authenticated;

create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notification_settings_own on public.notification_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notification_prefs_own on public.notification_prefs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Notificações: a pessoa lê, marca como lida e apaga as suas; quem cria é o sistema.
revoke insert on public.notifications from authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete_own on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger notification_settings_updated_at before update on public.notification_settings
  for each row execute function private.set_updated_at();

-- R$ 1.234,56 (texto de notificação; o banco roda em locale C).
create or replace function private.brl(p_cents bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'R$ ' || translate(to_char(abs(p_cents) / 100.0, 'FM999,999,999,990.00'), ',.', '.,');
$$;

-- Cria a notificação (se a pessoa quiser esse tipo) e a fila por canal. Idempotente.
create or replace function private.notify(
  p_user uuid, p_workspace uuid, p_kind text, p_event_key text, p_title text, p_body text, p_url text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled boolean;
  v_push boolean;
  v_tg boolean;
  v_id uuid;
begin
  select p.enabled, p.push, p.telegram into v_enabled, v_push, v_tg
    from public.notification_prefs p where p.user_id = p_user and p.kind = p_kind;
  if not found then
    -- Padrão: tudo ligado, exceto "lançamento de outro membro" (opcional).
    v_enabled := p_kind <> 'member_entry';
    v_push := v_enabled;
    v_tg := v_enabled;
  end if;
  if not v_enabled then
    return null;
  end if;
  insert into public.notifications (user_id, workspace_id, kind, event_key, title, body, url)
  values (p_user, p_workspace, p_kind, p_event_key, left(p_title, 120), left(p_body, 400), coalesce(p_url, '/painel'))
  on conflict (user_id, event_key) do nothing
  returning id into v_id;
  if v_id is null then
    return null; -- já notificado
  end if;
  if v_push then
    insert into public.notification_deliveries (notification_id, channel) values (v_id, 'push');
  end if;
  if v_tg then
    insert into public.notification_deliveries (notification_id, channel) values (v_id, 'telegram');
  end if;
  return v_id;
end;
$$;
revoke all on function private.notify(uuid, uuid, text, text, text, text, text) from public;

-- Geração periódica (pg_cron a cada 15 min; só a partir das 08:00 de São Paulo).
create or replace function private.generate_notifications(p_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_local timestamp := p_now at time zone 'America/Sao_Paulo';
  v_today date := v_local::date;
  v_tomorrow date := v_local::date + 1;
  v_count int := 0;
  r record;
begin
  if v_local::time < time '08:00' then
    return 0;
  end if;

  -- Contas (previstas, fora do cartão) vencendo amanhã.
  for r in
    select t.id, t.workspace_id, t.description, t.amount_cents, m.user_id
      from public.transactions t
      join public.workspace_members m on m.workspace_id = t.workspace_id
     where t.kind = 'expense' and not t.is_settled and t.payment_method <> 'credit' and t.occurred_on = v_tomorrow
  loop
    if private.notify(r.user_id, r.workspace_id, 'bill_due', 'bill_due:' || r.id,
         'Conta vence amanhã', r.description || ' · ' || private.brl(r.amount_cents), '/lancamentos') is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  -- Fatura fechando amanhã / vencendo amanhã (com saldo a pagar).
  for r in
    select s.invoice_id, s.workspace_id, s.card_id, s.closing_date, s.due_date, s.total_cents, s.remaining_cents,
           c.name as card_name, m.user_id
      from public.card_invoice_summaries s
      join public.credit_cards c on c.id = s.card_id
      join public.workspace_members m on m.workspace_id = s.workspace_id
     where (s.closing_date = v_tomorrow and s.total_cents > 0)
        or (s.due_date = v_tomorrow and s.remaining_cents > 0)
  loop
    if r.closing_date = v_tomorrow and private.notify(r.user_id, r.workspace_id, 'invoice_closing', 'invoice_closing:' || r.invoice_id,
         'Fatura do ' || r.card_name || ' fecha amanhã', 'Total até agora: ' || private.brl(r.total_cents),
         '/cartoes/' || r.card_id) is not null then
      v_count := v_count + 1;
    end if;
    if r.due_date = v_tomorrow and r.remaining_cents > 0 and private.notify(r.user_id, r.workspace_id, 'invoice_due', 'invoice_due:' || r.invoice_id,
         'Fatura do ' || r.card_name || ' vence amanhã', 'A pagar: ' || private.brl(r.remaining_cents),
         '/cartoes/' || r.card_id) is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  -- Aporte planejado para hoje.
  for r in
    select c.id, c.workspace_id, c.goal_id, c.amount_cents, g.name as goal_name, m.user_id
      from public.goal_contributions c
      join public.goals g on g.id = c.goal_id
      join public.workspace_members m on m.workspace_id = c.workspace_id
     where c.is_planned and c.contributed_on = v_today
  loop
    if private.notify(r.user_id, r.workspace_id, 'planned_contribution', 'planned_contribution:' || r.id,
         'Aporte planejado hoje', private.brl(r.amount_cents) || ' para a meta ' || r.goal_name, '/metas/' || r.goal_id) is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  -- Resumo semanal (segunda-feira): semana anterior, só realizado.
  if extract(isodow from v_today) = 1 then
    for r in
      select w.id as workspace_id, w.name, m.user_id,
             coalesce(sum(t.amount_cents) filter (where t.kind = 'expense'), 0)::bigint as spent,
             coalesce(sum(t.amount_cents) filter (where t.kind = 'income'), 0)::bigint as earned
        from public.workspaces w
        join public.workspace_members m on m.workspace_id = w.id
        join public.transactions t on t.workspace_id = w.id
       where t.is_settled and t.occurred_on between v_today - 7 and v_today - 1
       group by w.id, w.name, m.user_id
    loop
      if private.notify(r.user_id, r.workspace_id, 'weekly_summary', 'weekly_summary:' || r.workspace_id || ':' || v_today,
           'Resumo da semana · ' || r.name, 'Gastos ' || private.brl(r.spent) || ' · Receitas ' || private.brl(r.earned),
           '/painel') is not null then
        v_count := v_count + 1;
      end if;
    end loop;
  end if;

  -- Categoria acima da média (mês atual × média dos 3 meses anteriores; média ≥ R$ 50).
  for r in
    with cur as (
      select t.workspace_id, t.category_id, sum(t.amount_cents)::bigint as total
        from public.transactions t
       where t.kind = 'expense' and t.is_settled and t.category_id is not null
         and t.occurred_on between private.month_start(v_today) and v_today
       group by 1, 2
    ), prev as (
      select t.workspace_id, t.category_id, (sum(t.amount_cents) / 3)::bigint as avg_month
        from public.transactions t
       where t.kind = 'expense' and t.is_settled and t.category_id is not null
         and t.occurred_on >= private.add_months(private.month_start(v_today), -3)
         and t.occurred_on < private.month_start(v_today)
       group by 1, 2
    )
    select cur.workspace_id, cur.category_id, cur.total, prev.avg_month, c.name as category_name, m.user_id
      from cur
      join prev on prev.workspace_id = cur.workspace_id and prev.category_id = cur.category_id
      join public.categories c on c.id = cur.category_id
      join public.workspace_members m on m.workspace_id = cur.workspace_id
     where prev.avg_month >= 5000 and cur.total > prev.avg_month
  loop
    if private.notify(r.user_id, r.workspace_id, 'category_above_avg',
         'category_above_avg:' || r.category_id || ':' || private.month_start(v_today),
         r.category_name || ' acima da média',
         'Este mês: ' || private.brl(r.total) || ' · média: ' || private.brl(r.avg_month),
         '/painel') is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;
revoke all on function private.generate_notifications(timestamptz) from public;

-- Meta atingida: na hora (trigger), para todos os membros do espaço.
create or replace function private.notify_goal_achieved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if new.status::text = 'achieved' and old.status::text is distinct from 'achieved' then
    for r in select m.user_id from public.workspace_members m where m.workspace_id = new.workspace_id loop
      perform private.notify(r.user_id, new.workspace_id, 'goal_achieved', 'goal_achieved:' || new.id || ':' || coalesce(new.achieved_at, now())::date,
        'Meta atingida! 🎉', 'Vocês chegaram a ' || private.brl(new.target_cents) || ' na meta ' || new.name, '/metas/' || new.id);
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function private.notify_goal_achieved() from public;
create trigger goals_notify_achieved after update of status on public.goals
  for each row execute function private.notify_goal_achieved();

-- Lançamento feito por outro membro da família (só para quem ligou essa opção).
create or replace function private.notify_member_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_author text;
begin
  if new.created_by is null or new.recurrence_id is not null then
    return new;
  end if;
  if (select kind from public.workspaces where id = new.workspace_id)::text <> 'household' then
    return new;
  end if;
  select coalesce(nullif(split_part(full_name, ' ', 1), ''), 'Alguém') into v_author from public.profiles where id = new.created_by;
  for r in
    select p.user_id from public.notification_prefs p
      join public.workspace_members m on m.user_id = p.user_id and m.workspace_id = new.workspace_id
     where p.kind = 'member_entry' and p.enabled and p.user_id <> new.created_by
  loop
    perform private.notify(r.user_id, new.workspace_id, 'member_entry', 'member_entry:' || new.id,
      coalesce(v_author, 'Alguém') || ' lançou ' || case when new.kind = 'income' then 'uma receita' else 'um gasto' end,
      new.description || ' · ' || private.brl(new.amount_cents), '/lancamentos');
  end loop;
  return new;
end;
$$;
revoke all on function private.notify_member_entry() from public;
create trigger transactions_notify_member after insert on public.transactions
  for each row execute function private.notify_member_entry();

-- Dispatcher (servidor, service_role): pega um lote da fila respeitando o horário
-- de silêncio de cada pessoa. FOR UPDATE SKIP LOCKED: dois disparos ao mesmo tempo
-- nunca pegam a mesma entrega (nunca notifica duas vezes).
create or replace function public.claim_notification_deliveries(p_limit int default 50)
returns table (
  delivery_id uuid, channel text, attempts smallint, user_id uuid,
  title text, body text, url text, telegram_chat_id text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select d.id
      from public.notification_deliveries d
      join public.notifications n on n.id = d.notification_id
      left join public.notification_settings s on s.user_id = n.user_id
     where (d.status = 'pending' or (d.status = 'sending' and d.next_attempt_at < now() - interval '10 minutes'))
       and d.next_attempt_at <= now()
       and not (
         coalesce(s.quiet_enabled, true) and (
           case when coalesce(s.quiet_start, '22:00') > coalesce(s.quiet_end, '07:00')
                then (now() at time zone 'America/Sao_Paulo')::time >= coalesce(s.quiet_start, '22:00')
                  or (now() at time zone 'America/Sao_Paulo')::time < coalesce(s.quiet_end, '07:00')
                else (now() at time zone 'America/Sao_Paulo')::time >= coalesce(s.quiet_start, '22:00')
                 and (now() at time zone 'America/Sao_Paulo')::time < coalesce(s.quiet_end, '07:00')
           end)
       )
     order by d.next_attempt_at
     limit greatest(1, least(p_limit, 200))
     for update of d skip locked
  ), upd as (
    update public.notification_deliveries d
       set status = 'sending', attempts = d.attempts + 1, next_attempt_at = now()
      from due where d.id = due.id
    returning d.id, d.channel, d.attempts, d.notification_id
  )
  select upd.id, upd.channel, upd.attempts, n.user_id, n.title, n.body, n.url,
         (select l.external_id from public.channel_links l where l.user_id = n.user_id and l.channel = 'telegram' limit 1)
    from upd join public.notifications n on n.id = upd.notification_id;
end;
$$;
revoke all on function public.claim_notification_deliveries(int) from public, anon, authenticated;
grant execute on function public.claim_notification_deliveries(int) to service_role;

-- Resultado do envio: ok → sent; sem destino → skipped; erro → tenta de novo com
-- espera crescente (1, 5, 30 min, 2 h); depois de 5 tentativas → dead (dead-letter).
create or replace function public.finish_notification_delivery(p_id uuid, p_result text, p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempts smallint;
begin
  if p_result not in ('sent', 'skipped', 'retry') then
    raise exception 'Resultado inválido' using errcode = '22023';
  end if;
  select attempts into v_attempts from public.notification_deliveries where id = p_id;
  update public.notification_deliveries
     set status = case when p_result = 'retry' and v_attempts >= 5 then 'dead'
                       when p_result = 'retry' then 'pending' else p_result end,
         sent_at = case when p_result = 'sent' then now() else sent_at end,
         last_error = left(p_error, 500),
         next_attempt_at = now() + case v_attempts when 1 then interval '1 minute' when 2 then interval '5 minutes'
                                                   when 3 then interval '30 minutes' else interval '2 hours' end
   where id = p_id;
end;
$$;
revoke all on function public.finish_notification_delivery(uuid, text, text) from public, anon, authenticated;
grant execute on function public.finish_notification_delivery(uuid, text, text) to service_role;

-- Dead-letter visível (rodar no SQL Editor do Supabase): entregas e updates do
-- Telegram que desistiram. Sem conteúdo de mensagem, só metadados e o erro.
create view public.ops_dead_letters with (security_invoker = true) as
  select 'notificacao'::text as origem, d.id::text as ref, n.kind as tipo, d.attempts, d.last_error, d.created_at
    from public.notification_deliveries d join public.notifications n on n.id = d.notification_id
   where d.status = 'dead'
  union all
  select 'telegram', u.update_id::text, u.kind, u.attempts, u.last_error, u.received_at
    from public.telegram_updates u where u.status in ('dead', 'failed');
revoke all on public.ops_dead_letters from public, anon, authenticated;
grant select on public.ops_dead_letters to service_role;

-- -----------------------------------------------------------------------------
-- 5. Agendamento: gera notificações e chama o dispatcher do app (pg_net).
--    URL e segredo ficam no Vault (nunca no código): 'larmais_app_url' e
--    'larmais_cron_secret'. Sem eles, só gera (a central do app já mostra).
-- -----------------------------------------------------------------------------
create or replace function private.run_notifications()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  perform private.generate_notifications(now());
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'larmais_app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'larmais_cron_secret';
  if v_url is not null and v_secret is not null
     and exists (select 1 from public.notification_deliveries where status = 'pending' and next_attempt_at <= now()) then
    perform net.http_post(
      url := rtrim(v_url, '/') || '/api/notifications/dispatch',
      headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', v_secret),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  end if;
end;
$$;
revoke all on function private.run_notifications() from public;
select cron.schedule('notificacoes', '*/15 * * * *', $$ select private.run_notifications() $$);

-- Limpeza (junto com a do assistente): notificações > 90 dias, updates > 14 dias.
create or replace function private.cleanup_assistant()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.assistant_sessions where expires_at < now() - interval '1 day';
  delete from public.assistant_usage where day < private.today_sp() - 60;
  delete from public.telegram_updates where received_at < now() - interval '14 days' and status in ('done', 'ignored');
  delete from public.notifications where created_at < now() - interval '90 days';
  delete from public.channel_link_codes where created_at < now() - interval '1 day';
$$;
