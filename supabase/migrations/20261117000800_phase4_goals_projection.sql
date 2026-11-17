-- =============================================================================
-- 0008 · Fase 4: metas, aportes/retiradas, aporte planejado (recorrência) e
--        motor de projeção a partir das REGRAS (até 36 meses).
-- -----------------------------------------------------------------------------
-- Decisões: ADR-0016 (aporte não é despesa) e ADR-0017 (motor de projeção).
-- Regras: docs/requisitos.md RN-70…RN-89.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Metas: novos campos
-- -----------------------------------------------------------------------------
-- 'paused' só é USADO em funções plpgsql (avaliadas na execução): um valor novo
-- de enum não pode aparecer em SQL validado dentro da mesma transação.
alter type public.goal_status add value if not exists 'paused' before 'achieved';

alter table public.goals
  add column priority smallint not null default 2 check (priority between 1 and 3),
  add column initial_cents bigint not null default 0 check (initial_cents >= 0),
  add column reserve_account_id uuid,
  -- Rentabilidade anual ESTIMADA em pontos-base (1050 = 10,50% a.a.). Inteiro: nada de float.
  add column annual_return_bps integer not null default 0 check (annual_return_bps between 0 and 5000),
  add column notes text check (char_length(notes) <= 500),
  add constraint goals_reserve_fk foreign key (reserve_account_id, workspace_id)
    references public.accounts (id, workspace_id) on delete set null (reserve_account_id);
comment on column public.goals.priority is '1 = alta, 2 = média, 3 = baixa.';
comment on column public.goals.initial_cents is 'Valor que já estava guardado ao criar a meta (não é movimento de dinheiro).';
comment on column public.goals.reserve_account_id is 'Conta de reserva ("caixinha") que recebe os aportes. Opcional.';

-- -----------------------------------------------------------------------------
-- Aportes: previsto/confirmado, ligação com a recorrência, motivo da retirada
-- -----------------------------------------------------------------------------
alter table public.goal_contributions
  add column is_planned boolean not null default false,
  add column recurrence_id uuid,
  add column recurrence_date date,
  add column updated_at timestamptz not null default now(),
  add constraint goal_contributions_withdrawal_note_chk
    check (amount_cents > 0 or char_length(btrim(coalesce(note, ''))) > 0),
  add constraint goal_contributions_recurrence_chk check (recurrence_id is null or recurrence_date is not null);
comment on column public.goal_contributions.amount_cents is 'Positivo = aporte; negativo = retirada (exige motivo em note).';
comment on column public.goal_contributions.account_id is 'Conta de onde o dinheiro saiu (aporte) ou para onde voltou (retirada).';

create unique index goal_contributions_recurrence_uq on public.goal_contributions (recurrence_id, recurrence_date)
  where recurrence_id is not null;
create trigger goal_contributions_updated_at before update on public.goal_contributions
  for each row execute function private.set_updated_at();

-- Aporte planejado = recorrência com goal_id (reaproveita geração, pg_cron, edição).
alter table public.recurrences add column goal_id uuid;
alter table public.recurrences
  add constraint recurrences_goal_fk foreign key (goal_id, workspace_id)
    references public.goals (id, workspace_id) on delete cascade,
  add constraint recurrences_goal_chk
    check (goal_id is null or (kind = 'expense' and card_id is null and category_id is null));
comment on column public.recurrences.goal_id is 'Aporte planejado para esta meta: gera goal_contributions (não transactions).';

alter table public.goal_contributions
  add constraint goal_contributions_recurrence_fk foreign key (recurrence_id, workspace_id)
    references public.recurrences (id, workspace_id) on delete set null (recurrence_id);

create index goal_contributions_account_idx on public.goal_contributions (account_id) where account_id is not null;
create index goals_reserve_idx on public.goals (reserve_account_id) where reserve_account_id is not null;
create index recurrences_goal_idx on public.recurrences (goal_id) where goal_id is not null;

-- Auditoria também para metas e aportes.
create trigger goals_audit after insert or update or delete on public.goals
  for each row execute function private.audit();
create trigger goal_contributions_audit after insert or update or delete on public.goal_contributions
  for each row execute function private.audit();

-- -----------------------------------------------------------------------------
-- Regras dos aportes (RN-72…RN-76)
-- -----------------------------------------------------------------------------
create or replace function private.goal_saved(p_goal_id uuid, p_exclude uuid default null)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select g.initial_cents + coalesce((
    select sum(c.amount_cents) from public.goal_contributions c
    where c.goal_id = g.id and not c.is_planned and c.id is distinct from p_exclude), 0)
  from public.goals g where g.id = p_goal_id
$$;
revoke all on function private.goal_saved(uuid, uuid) from public;

create or replace function private.validate_goal_contribution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.goals%rowtype;
  v_after bigint;
begin
  select * into g from public.goals where id = new.goal_id for update;
  if g.status::text = 'archived' then
    raise exception 'Meta arquivada não recebe aportes' using errcode = '23514';
  end if;
  if not new.is_planned then
    v_after := private.goal_saved(new.goal_id, case when tg_op = 'UPDATE' then new.id end) + new.amount_cents;
    if v_after < 0 then
      raise exception 'A retirada é maior que o valor guardado na meta' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.validate_goal_contribution() from public;
create trigger goal_contributions_rules before insert or update on public.goal_contributions
  for each row execute function private.validate_goal_contribution();

-- Concluída automaticamente ao atingir o alvo; volta a ativa se uma retirada
-- deixar abaixo do alvo. Pausada/arquivada não mudam sozinhas.
create or replace function private.sync_goal_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_goal uuid := coalesce(new.goal_id, old.goal_id);
  v_saved bigint := private.goal_saved(v_goal);
begin
  update public.goals set status = 'achieved', achieved_at = now()
   where id = v_goal and status::text = 'active' and v_saved >= target_cents;
  update public.goals set status = 'active', achieved_at = null
   where id = v_goal and status::text = 'achieved' and v_saved < target_cents;
  return null;
end;
$$;
revoke all on function private.sync_goal_status() from public;
create trigger goal_contributions_status after insert or update or delete on public.goal_contributions
  for each row execute function private.sync_goal_status();

-- Mudou o alvo ou o valor inicial? Reavalia o status também.
create or replace function private.sync_goal_status_on_goal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_saved bigint := private.goal_saved(new.id);
begin
  if new.status::text = 'active' and v_saved >= new.target_cents then
    new.status := 'achieved';
    new.achieved_at := now();
  elsif new.status::text = 'achieved' and v_saved < new.target_cents then
    new.status := 'active';
    new.achieved_at := null;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_goal_status_on_goal() from public;
create trigger goals_status_sync before update of target_cents, initial_cents, status on public.goals
  for each row execute function private.sync_goal_status_on_goal();

-- -----------------------------------------------------------------------------
-- Recorrências: o gerador passa a criar APORTES PREVISTOS quando goal_id existe.
-- (mesma idempotência: unique (recurrence_id, recurrence_date))
-- -----------------------------------------------------------------------------
create or replace function private.generate_recurrence(p_recurrence_id uuid, p_until date)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recurrences%rowtype;
  v_from date;
  v_d date;
  v_count int := 0;
begin
  select * into r from public.recurrences where id = p_recurrence_id for update;
  if not found or not r.is_active then
    return 0;
  end if;
  v_from := coalesce(r.last_generated_on + 1, r.starts_on);

  for v_d in select * from private.recurrence_dates(r.frequency, r.day_of_month, r.starts_on, r.ends_on, v_from, p_until) loop
    if r.goal_id is not null then
      insert into public.goal_contributions (
        workspace_id, goal_id, amount_cents, contributed_on, account_id, note, source, member_user_id,
        is_planned, recurrence_id, recurrence_date, created_by
      ) values (
        r.workspace_id, r.goal_id, r.amount_cents, v_d, r.account_id, r.description, 'recurrence', r.member_user_id,
        not r.auto_confirm, r.id, v_d, r.created_by
      )
      on conflict (recurrence_id, recurrence_date) where recurrence_id is not null do nothing;
    else
      insert into public.transactions (
        workspace_id, kind, amount_cents, description, occurred_on, category_id, payment_method,
        account_id, card_id, invoice_id, member_user_id, source, is_settled, recurrence_id, recurrence_date, created_by
      ) values (
        r.workspace_id, r.kind, r.amount_cents, r.description, v_d, r.category_id, r.payment_method,
        r.account_id, r.card_id,
        case when r.card_id is not null then private.invoice_for(r.card_id, v_d) end,
        r.member_user_id, 'recurrence', r.auto_confirm, r.id, v_d, r.created_by
      )
      on conflict (recurrence_id, recurrence_date) where recurrence_id is not null do nothing;
    end if;
    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  if p_until >= v_from then
    update public.recurrences set last_generated_on = least(p_until, coalesce(r.ends_on, p_until))
    where id = r.id;
  end if;
  return v_count;
end;
$$;
revoke all on function private.generate_recurrence(uuid, date) from public;

create or replace function public.apply_recurrence_to_future(p_recurrence_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recurrences%rowtype;
  v_today date := private.today_sp();
begin
  select * into r from public.recurrences where id = p_recurrence_id;
  if not found or not private.is_member(r.workspace_id) then
    raise exception 'Recorrência não encontrada' using errcode = '42501';
  end if;
  if r.created_by is distinct from auth.uid() and not private.is_admin(r.workspace_id) then
    raise exception 'Você não tem permissão para alterar esta recorrência' using errcode = '42501';
  end if;

  delete from public.transactions
   where recurrence_id = r.id and not is_settled and recurrence_date >= v_today;
  delete from public.goal_contributions
   where recurrence_id = r.id and is_planned and recurrence_date >= v_today;
  update public.recurrences set last_generated_on = v_today - 1
   where id = r.id and (last_generated_on is null or last_generated_on >= v_today);
  return private.generate_recurrence(r.id, private.recurrence_horizon());
end;
$$;
revoke all on function public.apply_recurrence_to_future(uuid) from public, anon;
grant execute on function public.apply_recurrence_to_future(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Saldos das contas: aporte confirmado TIRA da conta de origem e (se houver)
-- COLOCA na conta de reserva da meta. Não é receita nem despesa (ADR-0016).
-- -----------------------------------------------------------------------------
create or replace view public.account_balances with (security_invoker = true) as
select
  a.id as account_id,
  a.workspace_id,
  a.name,
  a.type,
  a.color,
  a.archived_at,
  a.initial_balance_cents,
  (a.initial_balance_cents
    + coalesce((select sum(case when t.kind = 'income' then t.amount_cents else -t.amount_cents end)
                from public.transactions t
                where t.account_id = a.id and t.payment_method <> 'credit' and t.is_settled), 0)
    + coalesce((select sum(x.amount_cents) from public.transfers x where x.to_account_id = a.id), 0)
    - coalesce((select sum(x.amount_cents) from public.transfers x where x.from_account_id = a.id), 0)
    - coalesce((select sum(p.amount_cents) from public.invoice_payments p where p.account_id = a.id), 0)
    - coalesce((select sum(c.amount_cents) from public.goal_contributions c
                where c.account_id = a.id and not c.is_planned), 0)
    + coalesce((select sum(c.amount_cents) from public.goal_contributions c
                join public.goals g on g.id = c.goal_id
                where g.reserve_account_id = a.id and not c.is_planned), 0)
  )::bigint as balance_cents,
  coalesce((select sum(case when t.kind = 'income' then t.amount_cents else -t.amount_cents end)
            from public.transactions t
            where t.account_id = a.id and t.payment_method <> 'credit' and not t.is_settled), 0)::bigint
    as pending_cents
from public.accounts a;

-- -----------------------------------------------------------------------------
-- Resumo das metas (nada armazenado: guardado, previsto, plano, membros)
-- -----------------------------------------------------------------------------
create view public.goal_summaries with (security_invoker = true) as
select
  g.id as goal_id,
  g.workspace_id,
  g.name,
  g.icon,
  g.color,
  g.status,
  g.priority,
  g.target_cents,
  g.target_date,
  g.initial_cents,
  g.reserve_account_id,
  g.annual_return_bps,
  g.notes,
  g.created_at,
  g.achieved_at,
  (g.initial_cents + coalesce(s.confirmed, 0))::bigint as saved_cents,
  coalesce(s.deposits, 0)::bigint as deposited_cents,
  coalesce(s.withdrawals, 0)::bigint as withdrawn_cents,
  coalesce(s.planned, 0)::bigint as planned_cents,
  coalesce(s.entries, 0)::int as contributions_count,
  s.last_on as last_contribution_on,
  p.id as plan_recurrence_id,
  p.amount_cents as plan_amount_cents,
  p.frequency as plan_frequency,
  p.day_of_month as plan_day,
  p.account_id as plan_account_id,
  p.auto_confirm as plan_auto_confirm
from public.goals g
left join lateral (
  select sum(c.amount_cents) filter (where not c.is_planned) as confirmed,
         sum(c.amount_cents) filter (where not c.is_planned and c.amount_cents > 0) as deposits,
         -sum(c.amount_cents) filter (where not c.is_planned and c.amount_cents < 0) as withdrawals,
         sum(c.amount_cents) filter (where c.is_planned) as planned,
         count(*) filter (where not c.is_planned) as entries,
         max(c.contributed_on) filter (where not c.is_planned) as last_on
  from public.goal_contributions c where c.goal_id = g.id
) s on true
left join lateral (
  select r.* from public.recurrences r
  where r.goal_id = g.id and r.is_active
  order by r.created_at desc limit 1
) p on true;

grant select on public.goal_summaries to authenticated;
revoke all on public.goal_summaries from anon;

-- -----------------------------------------------------------------------------
-- MOTOR DE PROJEÇÃO (ADR-0017): ocorrências VIRTUAIS das recorrências ativas
-- depois do que já foi gerado no banco. Nada é gravado.
-- Como o gerador cria tudo até o fim do mês atual, o mês atual não tem
-- ocorrência virtual nenhuma → os números da Fase 3 ficam idênticos.
-- -----------------------------------------------------------------------------
create or replace function private.projected_occurrences(p_workspace_id uuid, p_from date, p_to date)
returns table (
  recurrence_id uuid,
  goal_id uuid,
  kind public.transaction_kind,
  amount_cents bigint,
  occurred_on date,
  due_date date,
  description text,
  category_id uuid,
  payment_method public.payment_method,
  account_id uuid,
  card_id uuid,
  member_id uuid
)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.id, r.goal_id, r.kind, r.amount_cents, d.d,
         case when r.card_id is not null then
           (select ic.due_date from public.credit_cards c
              cross join lateral private.invoice_cycle(c.closing_day, c.due_day, d.d) ic
             where c.id = r.card_id)
         end,
         r.description, r.category_id, r.payment_method, r.account_id, r.card_id,
         coalesce(r.member_user_id, r.created_by)
  from public.recurrences r
  cross join lateral private.recurrence_dates(
    r.frequency, r.day_of_month, r.starts_on, r.ends_on,
    greatest(p_from, coalesce(r.last_generated_on, r.starts_on - 1) + 1),
    -- Limite de segurança: no máximo 37 meses à frente de hoje.
    least(p_to, private.add_months(private.today_sp(), 37))
  ) as d(d)
  where r.workspace_id = p_workspace_id
    and r.is_active
$$;
revoke all on function private.projected_occurrences(uuid, date, date) from public;
grant execute on function private.projected_occurrences(uuid, date, date) to authenticated, service_role;
grant execute on function private.recurrence_dates(public.recurrence_frequency, int, date, date, date, date) to authenticated, service_role;

-- analytics_entries ganha as linhas projetadas (is_projected) e is_fixed
-- (recorrência ou parcela). As demais funções analíticas não mudam de assinatura.
drop function public.analytics_entries(uuid, date, date, public.analytics_basis, uuid, uuid, uuid, uuid);
create function public.analytics_entries(
  p_workspace_id uuid,
  p_from date,
  p_to date,
  p_basis public.analytics_basis default 'accrual',
  p_category_id uuid default null,
  p_member_id uuid default null,
  p_account_id uuid default null,
  p_card_id uuid default null,
  p_include_projected boolean default true
)
returns table (
  transaction_id uuid,
  kind public.transaction_kind,
  amount_cents bigint,
  bucket_date date,
  occurred_on date,
  description text,
  category_id uuid,
  root_category_id uuid,
  member_id uuid,
  payment_method public.payment_method,
  account_id uuid,
  card_id uuid,
  invoice_id uuid,
  is_planned boolean,
  installment_number smallint,
  installment_total smallint,
  is_projected boolean,
  is_fixed boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with paid_invoices as (
    select i.id, i.due_date,
           coalesce((select sum(p.amount_cents) from public.invoice_payments p where p.invoice_id = i.id), 0)
             >= coalesce((select sum(x.amount_cents) from public.transactions x where x.invoice_id = i.id), 0)
             as is_paid
    from public.card_invoices i
    where p_basis = 'cash'
      and i.workspace_id = p_workspace_id
      and i.due_date between p_from and p_to
      and (p_card_id is null or i.card_id = p_card_id)
  ),
  real_rows as (
    select t.id, t.kind, t.amount_cents, t.occurred_on as bucket, t.occurred_on, t.description, t.category_id,
           coalesce(t.member_user_id, t.created_by) as member_id, t.payment_method, t.account_id, t.card_id,
           t.invoice_id, (not t.is_settled or t.occurred_on > private.today_sp()) as planned,
           t.installment_number, t.installment_total,
           (t.recurrence_id is not null or t.installment_plan_id is not null) as fixed
    from public.transactions t
    where t.workspace_id = p_workspace_id
      and t.occurred_on between p_from and p_to
      and (p_basis = 'accrual' or t.payment_method <> 'credit')
    union all
    select t.id, t.kind, t.amount_cents, pi.due_date, t.occurred_on, t.description, t.category_id,
           coalesce(t.member_user_id, t.created_by), t.payment_method, t.account_id, t.card_id,
           t.invoice_id, not pi.is_paid, t.installment_number, t.installment_total,
           (t.recurrence_id is not null or t.installment_plan_id is not null)
    from paid_invoices pi
    join public.transactions t on t.invoice_id = pi.id
  ),
  virtual_rows as (
    -- Compra no cartão vence até ~2 meses depois: buscamos um pouco antes de p_from.
    select o.kind, o.amount_cents,
           case when p_basis = 'cash' and o.card_id is not null then o.due_date else o.occurred_on end as bucket,
           o.occurred_on, o.description, o.category_id, o.member_id, o.payment_method, o.account_id, o.card_id
    from private.projected_occurrences(p_workspace_id, p_from - 70, p_to) o
    where p_include_projected and o.goal_id is null
  ),
  all_rows as (
    select r.id, r.kind, r.amount_cents, r.bucket, r.occurred_on, r.description, r.category_id, r.member_id,
           r.payment_method, r.account_id, r.card_id, r.invoice_id, r.planned, r.installment_number,
           r.installment_total, false as projected, r.fixed
    from real_rows r
    union all
    select null, v.kind, v.amount_cents, v.bucket, v.occurred_on, v.description, v.category_id, v.member_id,
           v.payment_method, v.account_id, v.card_id, null, true, null, null, true, true
    from virtual_rows v
    where v.bucket between p_from and p_to
  )
  select r.id, r.kind, r.amount_cents, r.bucket, r.occurred_on, r.description,
         r.category_id, coalesce(c.parent_id, c.id), r.member_id,
         r.payment_method, r.account_id, r.card_id, r.invoice_id, r.planned,
         r.installment_number, r.installment_total, r.projected, r.fixed
  from all_rows r
  left join public.categories c on c.id = r.category_id
  where (p_category_id is null or r.category_id = p_category_id or c.parent_id = p_category_id)
    and (p_member_id is null or r.member_id = p_member_id)
    and (p_account_id is null or r.account_id = p_account_id)
    and (p_card_id is null or r.card_id = p_card_id)
$$;
revoke all on function public.analytics_entries(uuid, date, date, public.analytics_basis, uuid, uuid, uuid, uuid, boolean) from public, anon;
grant execute on function public.analytics_entries(uuid, date, date, public.analytics_basis, uuid, uuid, uuid, uuid, boolean) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Posição + saldo projetado agora com: ocorrências projetadas, aportes
-- previstos e efeito dos aportes nos saldos (ADR-0016/0017).
-- -----------------------------------------------------------------------------
drop function public.analytics_position(uuid, date, uuid, uuid);
create function public.analytics_position(
  p_workspace_id uuid,
  p_until date,
  p_account_id uuid default null,
  p_card_id uuid default null
)
returns table (
  balance_cents bigint,
  open_invoices_cents bigint,
  invoices_due_cents bigint,
  limit_cents bigint,
  available_limit_cents bigint,
  planned_income_cents bigint,
  planned_expense_cents bigint,
  planned_savings_cents bigint,
  projected_balance_cents bigint,
  is_projection boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with today as (select private.today_sp() as d),
  accts as (
    select a.id, a.initial_balance_cents
    from public.accounts a
    where a.workspace_id = p_workspace_id
      and (p_account_id is null or a.id = p_account_id)
      and (a.archived_at is null or p_account_id is not null)
  ),
  past_balance as (
    select (coalesce(sum(a.initial_balance_cents), 0)
      + coalesce((select sum(case when t.kind = 'income' then t.amount_cents else -t.amount_cents end)
                  from public.transactions t
                  where t.account_id in (select id from accts) and t.payment_method <> 'credit'
                    and t.is_settled and t.occurred_on <= p_until), 0)
      + coalesce((select sum(x.amount_cents) from public.transfers x
                  where x.to_account_id in (select id from accts) and x.occurred_on <= p_until), 0)
      - coalesce((select sum(x.amount_cents) from public.transfers x
                  where x.from_account_id in (select id from accts) and x.occurred_on <= p_until), 0)
      - coalesce((select sum(p.amount_cents) from public.invoice_payments p
                  where p.account_id in (select id from accts) and p.paid_on <= p_until), 0)
      - coalesce((select sum(c.amount_cents) from public.goal_contributions c
                  where c.account_id in (select id from accts) and not c.is_planned and c.contributed_on <= p_until), 0)
      + coalesce((select sum(c.amount_cents) from public.goal_contributions c
                  join public.goals g on g.id = c.goal_id
                  where g.reserve_account_id in (select id from accts) and not c.is_planned
                    and c.contributed_on <= p_until), 0))::bigint as v
    from accts a
  ),
  current_balance as (
    select coalesce(sum(b.balance_cents), 0)::bigint as v
    from public.account_balances b
    where b.account_id in (select id from accts)
  ),
  virt as (
    select * from private.projected_occurrences(p_workspace_id, private.today_sp() - 70, p_until)
  ),
  planned as (
    select
      coalesce(sum(x.amount_cents) filter (where x.kind = 'income'), 0)::bigint as inc,
      coalesce(sum(x.amount_cents) filter (where x.kind = 'expense'), 0)::bigint as exp
    from (
      select t.kind, t.amount_cents
      from public.transactions t
      where t.workspace_id = p_workspace_id and not t.is_settled and t.payment_method <> 'credit'
        and t.occurred_on <= p_until and (p_account_id is null or t.account_id = p_account_id)
      union all
      select v.kind, v.amount_cents from virt v
      where v.goal_id is null and v.card_id is null and v.occurred_on <= p_until
        and (p_account_id is null or v.account_id = p_account_id)
    ) x
  ),
  -- Efeito dos aportes PREVISTOS (reais e projetados) no saldo das contas consideradas.
  savings as (
    select coalesce(sum(
             case when x.account_id in (select id from accts) then x.amount_cents else 0 end
           - case when g.reserve_account_id in (select id from accts) then x.amount_cents else 0 end), 0)::bigint as v
    from (
      select c.goal_id, c.account_id, c.amount_cents
      from public.goal_contributions c
      where c.workspace_id = p_workspace_id and c.is_planned and c.contributed_on <= p_until
      union all
      select v.goal_id, v.account_id, v.amount_cents from virt v
      where v.goal_id is not null and v.occurred_on <= p_until
    ) x
    join public.goals g on g.id = x.goal_id
  ),
  invoices as (
    select s.card_id, s.closing_date, s.due_date, s.remaining_cents
    from public.card_invoice_summaries s
    join public.credit_cards c on c.id = s.card_id and c.archived_at is null
    where s.workspace_id = p_workspace_id
      and s.remaining_cents > 0
      and (p_card_id is null or s.card_id = p_card_id)
  ),
  open_inv as (
    select coalesce(sum(i.remaining_cents), 0)::bigint as v
    from invoices i, today
    where i.closing_date <= today.d
       or i.closing_date = (select min(ci.closing_date) from public.card_invoices ci
                            where ci.card_id = i.card_id and ci.closing_date > today.d)
  ),
  due_inv as (
    select (coalesce((select sum(i.remaining_cents) from invoices i where i.due_date <= p_until), 0)
          + coalesce((select sum(v.amount_cents) from virt v
                      where v.card_id is not null and v.due_date <= p_until
                        and (p_card_id is null or v.card_id = p_card_id)), 0))::bigint as v
  ),
  limits as (
    select coalesce(sum(s.limit_cents), 0)::bigint as lim, coalesce(sum(s.available_cents), 0)::bigint as avail
    from public.credit_card_summaries s
    where s.workspace_id = p_workspace_id and s.archived_at is null and s.limit_cents is not null
      and (p_card_id is null or s.card_id = p_card_id)
  )
  select
    case when p_until < today.d then past_balance.v else current_balance.v end,
    open_inv.v,
    case when p_until < today.d or p_account_id is not null then 0 else due_inv.v end,
    limits.lim,
    limits.avail,
    case when p_until < today.d then 0 else planned.inc end,
    case when p_until < today.d then 0 else planned.exp end,
    case when p_until < today.d then 0 else savings.v end,
    case when p_until < today.d then past_balance.v
         else current_balance.v + planned.inc - planned.exp - savings.v
              - case when p_account_id is not null then 0 else due_inv.v end end,
    p_until >= today.d
  from today, past_balance, current_balance, planned, savings, open_inv, due_inv, limits
$$;
revoke all on function public.analytics_position(uuid, date, uuid, uuid) from public, anon;
grant execute on function public.analytics_position(uuid, date, uuid, uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Guardado no período (aportes − retiradas), separado de despesas (RN-71).
-- -----------------------------------------------------------------------------
create or replace function public.analytics_savings(
  p_workspace_id uuid,
  p_from date,
  p_to date,
  p_member_id uuid default null,
  p_account_id uuid default null
)
returns table (
  saved_cents bigint,
  deposited_cents bigint,
  withdrawn_cents bigint,
  planned_cents bigint,
  entries int
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(c.amount_cents) filter (where not c.is_planned), 0)::bigint,
    coalesce(sum(c.amount_cents) filter (where not c.is_planned and c.amount_cents > 0), 0)::bigint,
    coalesce(-sum(c.amount_cents) filter (where not c.is_planned and c.amount_cents < 0), 0)::bigint,
    coalesce(sum(c.amount_cents) filter (where c.is_planned), 0)::bigint,
    count(*) filter (where not c.is_planned)::int
  from public.goal_contributions c
  where c.workspace_id = p_workspace_id
    and c.contributed_on between p_from and p_to
    and (p_member_id is null or coalesce(c.member_user_id, c.created_by) = p_member_id)
    and (p_account_id is null or c.account_id = p_account_id)
$$;

-- -----------------------------------------------------------------------------
-- Insumos da capacidade de poupança (RN-80): últimos N meses fechados
-- (realizado, competência) + próximo mês projetado. O cálculo final é puro em TS
-- (src/lib/goals/math.ts → savingsCapacity), com testes.
--   fixo = recorrência ou parcela (ou ocorrência projetada); variável = o resto.
-- -----------------------------------------------------------------------------
create or replace function public.planning_capacity_inputs(p_workspace_id uuid, p_months int default 6)
returns table (
  month date,
  is_projection boolean,
  income_fixed_cents bigint,
  income_variable_cents bigint,
  expense_fixed_cents bigint,
  expense_variable_cents bigint,
  saved_cents bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select private.month_start(private.today_sp()) as m0,
           greatest(1, least(coalesce(p_months, 6), 24)) as n
  ),
  months as (
    select private.add_months(b.m0, -k) as m, false as proj
    from bounds b, generate_series(1, (select n from bounds)) k
    union all
    select private.add_months(b.m0, 1), true from bounds b
  ),
  e as (
    select private.month_start(x.bucket_date) as m, x.kind, x.amount_cents, x.is_fixed
    from bounds b
    cross join lateral public.analytics_entries(p_workspace_id, private.add_months(b.m0, -b.n),
                                                private.add_months(b.m0, 2) - 1, 'accrual') x
  ),
  s as (
    select private.month_start(c.contributed_on) as m, sum(c.amount_cents) as v
    from public.goal_contributions c
    where c.workspace_id = p_workspace_id and not c.is_planned
    group by 1
  )
  select months.m, months.proj,
    coalesce(sum(e.amount_cents) filter (where e.kind = 'income' and e.is_fixed), 0)::bigint,
    coalesce(sum(e.amount_cents) filter (where e.kind = 'income' and not e.is_fixed), 0)::bigint,
    coalesce(sum(e.amount_cents) filter (where e.kind = 'expense' and e.is_fixed), 0)::bigint,
    coalesce(sum(e.amount_cents) filter (where e.kind = 'expense' and not e.is_fixed), 0)::bigint,
    coalesce(max(s.v), 0)::bigint
  from months
  left join e on e.m = months.m
  left join s on s.m = months.m
  group by months.m, months.proj
  order by months.m
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.analytics_savings(uuid, date, date, uuid, uuid)',
    'public.planning_capacity_inputs(uuid, int)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;
