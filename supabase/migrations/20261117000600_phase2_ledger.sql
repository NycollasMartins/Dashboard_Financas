-- =============================================================================
-- 0006 · Fase 2: lançamentos, cartões, faturas, parcelamento, recorrências,
--        transferências, pagamentos de fatura e auditoria.
-- -----------------------------------------------------------------------------
-- Regras: docs/requisitos.md (RN-10…RN-19, RN-50…RN-58). Decisões: ADR-0009…0011.
-- Toda a lógica crítica de datas mora aqui E em src/lib/domain/*.ts (mesmos
-- casos de teste nos dois lados).
-- =============================================================================

create extension if not exists pg_cron;

-- -----------------------------------------------------------------------------
-- Helpers de data (fuso America/Sao_Paulo)
-- -----------------------------------------------------------------------------
create or replace function private.today_sp()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- Data com o dia "preso" ao último dia do mês (dia 31 em fevereiro → 28/29).
create or replace function private.clamped_date(p_year int, p_month int, p_day int)
returns date
language sql
immutable
set search_path = ''
as $$
  select make_date(p_year, p_month, 1)
         + (least(p_day, extract(day from (make_date(p_year, p_month, 1) + interval '1 month - 1 day'))::int) - 1)
$$;

-- 1º dia do mês (sem date_trunc, que depende do fuso da sessão).
create or replace function private.month_start(p_date date)
returns date
language sql
immutable
set search_path = ''
as $$ select make_date(extract(year from p_date)::int, extract(month from p_date)::int, 1) $$;

-- 1º dia do mês de p_month somado de p_n meses.
create or replace function private.add_months(p_month date, p_n int)
returns date
language sql
immutable
set search_path = ''
as $$
  select make_date(((extract(year from p_month)::int * 12 + extract(month from p_month)::int - 1 + p_n) / 12),
                   ((extract(year from p_month)::int * 12 + extract(month from p_month)::int - 1 + p_n) % 12) + 1,
                   1)
$$;

-- -----------------------------------------------------------------------------
-- Ciclo da fatura (RN-10). Espelho de src/lib/domain/invoice.ts.
-- -----------------------------------------------------------------------------
create or replace function private.invoice_cycle(p_closing_day int, p_due_day int, p_date date)
returns table (reference_month date, closing_date date, due_date date)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_closing_this date := private.clamped_date(extract(year from p_date)::int, extract(month from p_date)::int, p_closing_day);
  v_closing_month date;
  v_due_month date;
begin
  -- Compra NO dia do fechamento ou depois → próximo ciclo.
  v_closing_month := case when p_date >= v_closing_this
                          then private.add_months(p_date, 1)
                          else private.month_start(p_date) end;
  v_due_month := case when p_due_day > p_closing_day then v_closing_month
                      else private.add_months(v_closing_month, 1) end;
  reference_month := v_due_month;
  closing_date := private.clamped_date(extract(year from v_closing_month)::int, extract(month from v_closing_month)::int, p_closing_day);
  due_date := private.clamped_date(extract(year from v_due_month)::int, extract(month from v_due_month)::int, p_due_day);
  return next;
end;
$$;

-- Datas de fechamento/vencimento de uma fatura identificada pelo mês de vencimento.
create or replace function private.invoice_dates_for_reference(p_closing_day int, p_due_day int, p_reference_month date)
returns table (closing_date date, due_date date)
language sql
immutable
set search_path = ''
as $$
  with m as (
    select private.month_start(p_reference_month) as due_month,
           case when p_due_day > p_closing_day then private.month_start(p_reference_month)
                else private.add_months(p_reference_month, -1) end as closing_month
  )
  select private.clamped_date(extract(year from closing_month)::int, extract(month from closing_month)::int, p_closing_day),
         private.clamped_date(extract(year from due_month)::int, extract(month from due_month)::int, p_due_day)
  from m
$$;

-- -----------------------------------------------------------------------------
-- Faturas: status/pagamento passam a ser CALCULADOS (ADR-0010).
-- -----------------------------------------------------------------------------
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.card_invoices'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.card_invoices drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.card_invoices
  drop column status,
  drop column paid_at,
  drop column paid_amount_cents,
  drop column paid_from_account_id;
drop type public.invoice_status;

-- Garante (cria se preciso) a fatura do cartão para um mês de vencimento.
create or replace function private.ensure_invoice(p_card_id uuid, p_reference_month date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card public.credit_cards%rowtype;
  v_id uuid;
  v_dates record;
begin
  select * into v_card from public.credit_cards where id = p_card_id;
  if not found then
    raise exception 'Cartão não encontrado' using errcode = '23503';
  end if;
  select * into v_dates from private.invoice_dates_for_reference(v_card.closing_day, v_card.due_day, p_reference_month);

  insert into public.card_invoices (workspace_id, card_id, reference_month, closing_date, due_date)
  values (v_card.workspace_id, v_card.id, private.month_start(p_reference_month), v_dates.closing_date, v_dates.due_date)
  on conflict (card_id, reference_month) do nothing;

  select id into v_id from public.card_invoices
  where card_id = p_card_id and reference_month = private.month_start(p_reference_month);
  return v_id;
end;
$$;

-- Fatura de uma compra feita em p_date, deslocada p_offset meses (parcelas).
create or replace function private.invoice_for(p_card_id uuid, p_date date, p_offset int default 0)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card public.credit_cards%rowtype;
  v_ref date;
begin
  select * into v_card from public.credit_cards where id = p_card_id;
  if not found then
    raise exception 'Cartão não encontrado' using errcode = '23503';
  end if;
  select reference_month into v_ref from private.invoice_cycle(v_card.closing_day, v_card.due_day, p_date);
  return private.ensure_invoice(p_card_id, private.add_months(v_ref, p_offset));
end;
$$;

revoke all on function private.ensure_invoice(uuid, date) from public;
revoke all on function private.invoice_for(uuid, date, int) from public;
grant execute on function private.invoice_for(uuid, date, int) to authenticated, service_role;
grant execute on function private.ensure_invoice(uuid, date) to authenticated, service_role;
grant execute on function private.invoice_cycle(int, int, date) to authenticated, service_role;
grant execute on function private.today_sp() to authenticated, service_role;
grant execute on function private.clamped_date(int, int, int) to authenticated, service_role;
grant execute on function private.add_months(date, int) to authenticated, service_role;
grant execute on function private.month_start(date) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Categorias: subcategorias (1 nível) e exclusão só com reatribuição.
-- -----------------------------------------------------------------------------
alter table public.categories add column parent_id uuid;
alter table public.categories
  add constraint categories_parent_fk foreign key (parent_id, workspace_id)
  references public.categories (id, workspace_id) on delete restrict;
alter table public.categories add constraint categories_not_self_parent check (parent_id is null or parent_id <> id);

create or replace function private.validate_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_parent public.categories%rowtype;
begin
  if new.parent_id is not null then
    select * into v_parent from public.categories where id = new.parent_id;
    if v_parent.parent_id is not null then
      raise exception 'Subcategorias só têm um nível' using errcode = '23514';
    end if;
    if v_parent.kind <> new.kind then
      raise exception 'A subcategoria precisa ser do mesmo tipo da categoria-mãe' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger categories_validate before insert or update on public.categories
  for each row execute function private.validate_category();

-- Referências a categoria passam a ser RESTRICT: não se apaga categoria em uso.
do $$
declare c record;
begin
  for c in select conrelid::regclass as tbl, conname from pg_constraint
           where contype = 'f' and confrelid = 'public.categories'::regclass
             and conrelid in ('public.transactions'::regclass, 'public.recurrences'::regclass, 'public.installment_plans'::regclass)
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
    execute format('alter table %s add constraint %I foreign key (category_id, workspace_id) references public.categories (id, workspace_id) on delete restrict',
                   c.tbl, c.conname);
  end loop;
end $$;

-- Exclui categoria reatribuindo lançamentos/recorrências/parcelamentos (RN-19).
create or replace function public.delete_category(p_category_id uuid, p_reassign_to uuid default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_cat public.categories%rowtype;
  v_target public.categories%rowtype;
  v_in_use boolean;
begin
  select * into v_cat from public.categories where id = p_category_id;
  if not found then
    raise exception 'Categoria não encontrada' using errcode = '22023';
  end if;

  v_in_use := exists (select 1 from public.transactions where category_id = p_category_id)
           or exists (select 1 from public.recurrences where category_id = p_category_id)
           or exists (select 1 from public.installment_plans where category_id = p_category_id)
           or exists (select 1 from public.categories where parent_id = p_category_id);

  if v_in_use then
    if p_reassign_to is null then
      raise exception 'Categoria em uso: escolha outra para receber os lançamentos' using errcode = '23503';
    end if;
    select * into v_target from public.categories where id = p_reassign_to;
    if not found or v_target.workspace_id <> v_cat.workspace_id or v_target.kind <> v_cat.kind or v_target.id = v_cat.id then
      raise exception 'Categoria de destino inválida' using errcode = '22023';
    end if;
    update public.transactions set category_id = p_reassign_to where category_id = p_category_id;
    update public.recurrences set category_id = p_reassign_to where category_id = p_category_id;
    update public.installment_plans set category_id = p_reassign_to where category_id = p_category_id;
    update public.categories set parent_id = null where parent_id = p_category_id;
  end if;

  delete from public.categories where id = p_category_id;
  if not found then
    raise exception 'Você não tem permissão para excluir esta categoria' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.delete_category(uuid, uuid) from public, anon;
grant execute on function public.delete_category(uuid, uuid) to authenticated;

-- Garante as categorias padrão nos espaços que já existiam.
select private.seed_default_categories(id) from public.workspaces;

-- -----------------------------------------------------------------------------
-- Recorrências: frequência semanal/mensal/anual e confirmação automática.
-- -----------------------------------------------------------------------------
create type public.recurrence_frequency as enum ('weekly', 'monthly', 'yearly');

alter table public.recurrences drop column last_generated_month;
alter table public.recurrences
  add column frequency public.recurrence_frequency not null default 'monthly',
  add column auto_confirm boolean not null default false,
  add column last_generated_on date;
comment on column public.recurrences.day_of_month is 'Mensal/anual: dia (29–31 → último dia do mês). Semanal: ignorado (usa o dia da semana de starts_on).';
comment on column public.recurrences.auto_confirm is 'true = lançamentos gerados já entram como confirmados (ex.: assinatura no cartão).';

-- transactions.recurrence_month → recurrence_date (data exata da ocorrência)
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.transactions'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%recurrence_month%'
  loop
    execute format('alter table public.transactions drop constraint %I', c.conname);
  end loop;
end $$;
drop index public.transactions_recurrence_month_uq;
alter table public.transactions rename column recurrence_month to recurrence_date;
alter table public.transactions add constraint transactions_recurrence_date_chk
  check (recurrence_id is null or recurrence_date is not null);
create unique index transactions_recurrence_date_uq on public.transactions (recurrence_id, recurrence_date)
  where recurrence_id is not null;

-- Datas de ocorrência de uma recorrência no intervalo [p_from, p_to].
create or replace function private.recurrence_dates(
  p_frequency public.recurrence_frequency, p_day_of_month int, p_starts_on date, p_ends_on date, p_from date, p_to date
)
returns setof date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_from date := greatest(p_from, p_starts_on);
  v_to date := least(p_to, coalesce(p_ends_on, p_to));
  v_d date;
  v_m date;
begin
  if v_from > v_to then
    return;
  end if;
  if p_frequency = 'weekly' then
    v_d := p_starts_on + (ceil(greatest(v_from - p_starts_on, 0) / 7.0)::int * 7);
    while v_d <= v_to loop
      return next v_d;
      v_d := v_d + 7;
    end loop;
  elsif p_frequency = 'monthly' then
    v_m := private.month_start(v_from);
    while v_m <= v_to loop
      v_d := private.clamped_date(extract(year from v_m)::int, extract(month from v_m)::int, p_day_of_month);
      if v_d between v_from and v_to then
        return next v_d;
      end if;
      v_m := private.add_months(v_m, 1);
    end loop;
  else -- yearly: mesmo mês de starts_on
    for y in extract(year from v_from)::int .. extract(year from v_to)::int loop
      v_d := private.clamped_date(y, extract(month from p_starts_on)::int, p_day_of_month);
      if v_d between v_from and v_to then
        return next v_d;
      end if;
    end loop;
  end if;
end;
$$;
grant execute on function private.recurrence_dates(public.recurrence_frequency, int, date, date, date, date) to authenticated, service_role;

-- Gera os lançamentos de UMA recorrência até p_until (idempotente: RN-14).
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

-- Horizonte padrão: até o fim do mês corrente (São Paulo).
create or replace function private.recurrence_horizon()
returns date
language sql
stable
set search_path = ''
as $$ select (private.add_months(private.today_sp(), 1) - 1) $$;

create or replace function private.generate_all_recurrences()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total int := 0;
  v_id uuid;
begin
  for v_id in select id from public.recurrences where is_active loop
    -- Uma recorrência com problema não pode impedir as outras.
    begin
      v_total := v_total + private.generate_recurrence(v_id, private.recurrence_horizon());
    exception when others then
      raise warning 'Recorrência % não gerada: %', v_id, sqlerrm;
    end;
  end loop;
  return v_total;
end;
$$;
revoke all on function private.generate_all_recurrences() from public;

-- Ao criar/editar uma recorrência, gera na hora o mês corrente.
create or replace function private.on_recurrence_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.generate_recurrence(new.id, private.recurrence_horizon());
  return null;
end;
$$;
create trigger recurrences_generate after insert on public.recurrences
  for each row execute function private.on_recurrence_change();

-- Editar recorrência "daqui pra frente": refaz as ocorrências PREVISTAS a partir
-- de hoje com os novos dados. Confirmadas e passadas nunca mudam (RN-16).
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
  update public.recurrences set last_generated_on = v_today - 1
   where id = r.id and (last_generated_on is null or last_generated_on >= v_today);
  return private.generate_recurrence(r.id, private.recurrence_horizon());
end;
$$;
revoke all on function public.apply_recurrence_to_future(uuid) from public, anon;
grant execute on function public.apply_recurrence_to_future(uuid) to authenticated;

-- Força a geração para um espaço (botão "atualizar" / primeira visita do mês).
create or replace function public.generate_workspace_recurrences(p_workspace_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_total int := 0;
begin
  if not private.is_member(p_workspace_id) then
    raise exception 'Você não participa deste espaço' using errcode = '42501';
  end if;
  for v_id in select id from public.recurrences where workspace_id = p_workspace_id and is_active loop
    v_total := v_total + private.generate_recurrence(v_id, private.recurrence_horizon());
  end loop;
  return v_total;
end;
$$;
revoke all on function public.generate_workspace_recurrences(uuid) from public, anon;
grant execute on function public.generate_workspace_recurrences(uuid) to authenticated;

-- pg_cron: todo dia às 03:00 de São Paulo (06:00 UTC).
select cron.schedule('gerar-recorrencias', '0 6 * * *', $$ select private.generate_all_recurrences() $$);

-- -----------------------------------------------------------------------------
-- Lançamentos: fatura atribuída automaticamente no crédito + updated_by.
-- -----------------------------------------------------------------------------
alter table public.transactions add column updated_by uuid references auth.users (id) on delete set null;

create or replace function private.assign_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_method <> 'credit' then
    new.card_id := null;
    new.invoice_id := null;
    return new;
  end if;
  if new.card_id is null then
    raise exception 'Compra no crédito precisa de um cartão' using errcode = '23514';
  end if;
  if new.invoice_id is null
     or (tg_op = 'UPDATE' and new.installment_plan_id is null
         and (new.card_id <> old.card_id or new.occurred_on <> old.occurred_on)) then
    new.invoice_id := private.invoice_for(new.card_id, new.occurred_on);
  end if;
  return new;
end;
$$;
create trigger transactions_assign_invoice before insert or update on public.transactions
  for each row execute function private.assign_invoice();

create or replace function private.set_updated_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Durante a exclusão da conta o usuário está sumindo: não grava o id dele.
  if auth.uid() is not null and coalesce(current_setting('app.deleting_account', true), 'off') <> 'on' then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger transactions_updated_by before update on public.transactions
  for each row execute function private.set_updated_by();

-- -----------------------------------------------------------------------------
-- Compra no cartão (à vista ou parcelada) — RN-10, RN-11.
-- SECURITY INVOKER: as inserções passam pela RLS do usuário.
-- -----------------------------------------------------------------------------
create or replace function public.create_card_purchase(
  p_workspace_id uuid,
  p_card_id uuid,
  p_total_cents bigint,
  p_installments int,
  p_description text,
  p_occurred_on date,
  p_category_id uuid default null,
  p_member_user_id uuid default null,
  p_notes text default null,
  p_source public.entry_source default 'manual'
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_plan uuid;
  v_base bigint;
  v_rest bigint;
  v_first uuid;
  v_id uuid;
begin
  if p_installments is null or p_installments < 1 or p_installments > 48 then
    raise exception 'Número de parcelas inválido (1 a 48)' using errcode = '22023';
  end if;
  if p_total_cents is null or p_total_cents < p_installments then
    raise exception 'Valor inválido para o número de parcelas' using errcode = '22023';
  end if;

  if p_installments = 1 then
    insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on, category_id,
                                     payment_method, card_id, member_user_id, notes, source)
    values (p_workspace_id, 'expense', p_total_cents, p_description, p_occurred_on, p_category_id,
            'credit', p_card_id, p_member_user_id, p_notes, p_source)
    returning id into v_id;
    return v_id;
  end if;

  insert into public.installment_plans (workspace_id, card_id, description, total_amount_cents, installment_count,
                                        purchase_date, first_invoice_month, category_id)
  values (p_workspace_id, p_card_id, p_description, p_total_cents, p_installments, p_occurred_on,
          (select reference_month from public.card_invoices where id = private.invoice_for(p_card_id, p_occurred_on)),
          p_category_id)
  returning id into v_plan;

  v_base := p_total_cents / p_installments;
  v_rest := p_total_cents - v_base * p_installments;

  for k in 1 .. p_installments loop
    insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on, category_id,
                                     payment_method, card_id, invoice_id, installment_plan_id, installment_number,
                                     installment_total, member_user_id, notes, source)
    values (p_workspace_id, 'expense', v_base + case when k = 1 then v_rest else 0 end, p_description,
            -- competência da parcela k = data da compra + (k−1) meses (dia preso ao fim do mês)
            private.clamped_date(extract(year from private.add_months(p_occurred_on, k - 1))::int,
                                 extract(month from private.add_months(p_occurred_on, k - 1))::int,
                                 extract(day from p_occurred_on)::int),
            p_category_id, 'credit', p_card_id, private.invoice_for(p_card_id, p_occurred_on, k - 1),
            v_plan, k, p_installments, p_member_user_id, p_notes, p_source)
    returning id into v_id;
    if k = 1 then
      v_first := v_id;
    end if;
  end loop;
  return v_first;
end;
$$;
revoke all on function public.create_card_purchase(uuid, uuid, bigint, int, text, date, uuid, uuid, text, public.entry_source) from public, anon;
grant execute on function public.create_card_purchase(uuid, uuid, bigint, int, text, date, uuid, uuid, text, public.entry_source) to authenticated, service_role;

-- Editar/excluir parcelas com escopo: 'this' | 'this_and_future' | 'all'.
create or replace function public.update_installments(
  p_transaction_id uuid, p_scope text, p_description text, p_category_id uuid, p_notes text, p_member_user_id uuid
)
returns int
language plpgsql
set search_path = ''
as $$
declare
  t public.transactions%rowtype;
  v_count int;
begin
  select * into t from public.transactions where id = p_transaction_id;
  if not found or t.installment_plan_id is null then
    raise exception 'Parcela não encontrada' using errcode = '22023';
  end if;
  if p_scope not in ('this', 'this_and_future', 'all') then
    raise exception 'Escopo inválido' using errcode = '22023';
  end if;

  update public.transactions
     set description = p_description, category_id = p_category_id, notes = p_notes, member_user_id = p_member_user_id
   where installment_plan_id = t.installment_plan_id
     and (p_scope = 'all'
          or (p_scope = 'this' and id = t.id)
          or (p_scope = 'this_and_future' and installment_number >= t.installment_number));
  get diagnostics v_count = row_count;

  if p_scope = 'all' then
    update public.installment_plans set description = p_description, category_id = p_category_id
    where id = t.installment_plan_id;
  end if;
  return v_count;
end;
$$;

create or replace function public.delete_installments(p_transaction_id uuid, p_scope text)
returns int
language plpgsql
set search_path = ''
as $$
declare
  t public.transactions%rowtype;
  v_count int;
begin
  select * into t from public.transactions where id = p_transaction_id;
  if not found or t.installment_plan_id is null then
    raise exception 'Parcela não encontrada' using errcode = '22023';
  end if;
  if p_scope not in ('this', 'this_and_future', 'all') then
    raise exception 'Escopo inválido' using errcode = '22023';
  end if;

  delete from public.transactions
   where installment_plan_id = t.installment_plan_id
     and (p_scope = 'all'
          or (p_scope = 'this' and id = t.id)
          or (p_scope = 'this_and_future' and installment_number >= t.installment_number));
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Você não tem permissão para excluir estas parcelas' using errcode = '42501';
  end if;

  -- Sem parcelas restantes → remove o plano.
  delete from public.installment_plans p
   where p.id = t.installment_plan_id
     and not exists (select 1 from public.transactions x where x.installment_plan_id = p.id);
  return v_count;
end;
$$;
revoke all on function public.update_installments(uuid, text, text, uuid, text, uuid) from public, anon;
revoke all on function public.delete_installments(uuid, text) from public, anon;
grant execute on function public.update_installments(uuid, text, text, uuid, text, uuid) to authenticated;
grant execute on function public.delete_installments(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Transferências entre contas (não são receita nem despesa) — RN-50.
-- -----------------------------------------------------------------------------
create table public.transfers (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  from_account_id uuid not null,
  to_account_id   uuid not null,
  amount_cents    bigint not null check (amount_cents > 0),
  occurred_on     date not null,
  description     text check (char_length(description) <= 140),
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (from_account_id <> to_account_id),
  foreign key (from_account_id, workspace_id) references public.accounts (id, workspace_id) on delete cascade,
  foreign key (to_account_id, workspace_id) references public.accounts (id, workspace_id) on delete cascade
);
create index transfers_ws_date_idx on public.transfers (workspace_id, occurred_on desc);

-- -----------------------------------------------------------------------------
-- Pagamentos de fatura: saída da conta, NÃO é despesa (ADR-0010) — RN-53.
-- -----------------------------------------------------------------------------
create table public.invoice_payments (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  invoice_id   uuid not null,
  account_id   uuid,
  amount_cents bigint not null check (amount_cents > 0),
  paid_on      date not null,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  foreign key (invoice_id, workspace_id) references public.card_invoices (id, workspace_id) on delete cascade,
  foreign key (account_id, workspace_id) references public.accounts (id, workspace_id) on delete set null (account_id)
);
create index invoice_payments_invoice_idx on public.invoice_payments (invoice_id);

-- Faturas com pagamentos não podem ser apagadas por engano.
do $$
declare t text;
begin
  foreach t in array array['transfers', 'invoice_payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke truncate, references, trigger on public.%I from authenticated', t);
    execute format('create trigger %I before insert on public.%I for each row execute function private.set_created_by()', t || '_created_by', t);
    execute format('create trigger %I before update on public.%I for each row execute function private.protect_ownership_columns()', t || '_protect', t);
    execute format($p$create policy %I on public.%I for select to authenticated
                      using (workspace_id in (select private.my_workspace_ids()))$p$, t || '_select', t);
    execute format($p$create policy %I on public.%I for insert to authenticated
                      with check (workspace_id in (select private.my_workspace_ids()))$p$, t || '_insert', t);
    execute format($p$create policy %I on public.%I for update to authenticated
                      using (workspace_id in (select private.my_workspace_ids())
                             and (created_by = (select auth.uid()) or private.is_admin(workspace_id)))
                      with check (workspace_id in (select private.my_workspace_ids()))$p$, t || '_update', t);
    execute format($p$create policy %I on public.%I for delete to authenticated
                      using (workspace_id in (select private.my_workspace_ids())
                             and (created_by = (select auth.uid()) or private.is_admin(workspace_id)))$p$, t || '_delete', t);
  end loop;
end $$;
create trigger transfers_updated_at before update on public.transfers
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Views calculadas (security_invoker → respeitam a RLS de quem consulta)
-- -----------------------------------------------------------------------------
-- Saldo das contas (RN-52): nunca armazenado; sempre derivado dos movimentos.
create view public.account_balances with (security_invoker = true) as
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
  )::bigint as balance_cents,
  coalesce((select sum(case when t.kind = 'income' then t.amount_cents else -t.amount_cents end)
            from public.transactions t
            where t.account_id = a.id and t.payment_method <> 'credit' and not t.is_settled), 0)::bigint
    as pending_cents
from public.accounts a;

-- Faturas com total, pago e status calculados (RN-54).
create view public.card_invoice_summaries with (security_invoker = true) as
select
  i.id as invoice_id,
  i.workspace_id,
  i.card_id,
  i.reference_month,
  i.closing_date,
  i.due_date,
  coalesce(t.total, 0)::bigint as total_cents,
  coalesce(p.paid, 0)::bigint as paid_cents,
  greatest(coalesce(t.total, 0) - coalesce(p.paid, 0), 0)::bigint as remaining_cents,
  coalesce(t.items, 0)::int as items,
  case
    when coalesce(t.total, 0) > 0 and coalesce(p.paid, 0) >= coalesce(t.total, 0) then 'paid'
    when private.today_sp() > i.due_date and coalesce(t.total, 0) > coalesce(p.paid, 0) then 'overdue'
    when private.today_sp() >= i.closing_date then 'closed'
    else 'open'
  end as status
from public.card_invoices i
left join lateral (
  select sum(amount_cents) as total, count(*) as items from public.transactions where invoice_id = i.id
) t on true
left join lateral (
  select sum(amount_cents) as paid from public.invoice_payments where invoice_id = i.id
) p on true;

-- Limite do cartão (RN-55): usado = compras − pagamentos (inclui parcelas futuras).
create view public.credit_card_summaries with (security_invoker = true) as
select
  c.id as card_id,
  c.workspace_id,
  c.name,
  c.brand,
  c.last4,
  c.color,
  c.closing_day,
  c.due_day,
  c.limit_cents,
  c.archived_at,
  greatest(coalesce(u.spent, 0) - coalesce(p.paid, 0), 0)::bigint as used_cents,
  case when c.limit_cents is null then null
       else (c.limit_cents - greatest(coalesce(u.spent, 0) - coalesce(p.paid, 0), 0))::bigint end as available_cents
from public.credit_cards c
left join lateral (select sum(amount_cents) as spent from public.transactions where card_id = c.id) u on true
left join lateral (
  select sum(ip.amount_cents) as paid
  from public.invoice_payments ip join public.card_invoices ci on ci.id = ip.invoice_id
  where ci.card_id = c.id
) p on true;

grant select on public.account_balances, public.card_invoice_summaries, public.credit_card_summaries to authenticated;
revoke all on public.account_balances, public.card_invoice_summaries, public.credit_card_summaries from anon;

-- -----------------------------------------------------------------------------
-- Auditoria (ADR-0009): quem criou/alterou/excluiu e quando, com antes/depois.
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  workspace_id uuid not null,  -- sem FK: o log sobrevive à exclusão do registro
  table_name  text not null,
  record_id   uuid not null,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  actor_id    uuid,
  at          timestamptz not null default now(),
  old_data    jsonb,
  new_data    jsonb
);
create index audit_log_ws_idx on public.audit_log (workspace_id, at desc);
create index audit_log_record_idx on public.audit_log (table_name, record_id, id desc);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
create policy audit_log_select on public.audit_log for select to authenticated
  using (workspace_id in (select private.my_workspace_ids()));

create or replace function private.audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_ws uuid := (v_row ->> 'workspace_id')::uuid;
begin
  -- Durante a exclusão de um espaço inteiro (cascata), não registra nada.
  if not exists (select 1 from public.workspaces where id = v_ws) then
    return null;
  end if;
  insert into public.audit_log (workspace_id, table_name, record_id, action, actor_id, old_data, new_data)
  values (v_ws, tg_table_name, (v_row ->> 'id')::uuid, tg_op, auth.uid(),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end;
$$;
revoke all on function private.audit() from public;

do $$
declare t text;
begin
  foreach t in array array['transactions', 'transfers', 'invoice_payments', 'recurrences', 'credit_cards',
                           'accounts', 'categories', 'installment_plans'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit()',
                   t || '_audit', t);
  end loop;
end $$;

-- created_by é forçado para o usuário logado, EXCETO ao restaurar um registro
-- (mantém o autor original).
create or replace function private.set_created_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and coalesce(current_setting('app.restoring', true), 'off') <> 'on' then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

-- Desfazer exclusão de lançamento (até 24 h, por quem excluiu ou admin).
create or replace function public.restore_deleted_transaction(p_transaction_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log public.audit_log%rowtype;
begin
  select * into v_log from public.audit_log
  where table_name = 'transactions' and record_id = p_transaction_id and action = 'DELETE'
  order by id desc limit 1;

  if not found or v_log.at < now() - interval '24 hours' then
    raise exception 'Não há exclusão recente para desfazer' using errcode = '22023';
  end if;
  if not private.is_member(v_log.workspace_id)
     or (v_log.actor_id is distinct from auth.uid() and not private.is_admin(v_log.workspace_id)) then
    raise exception 'Você não pode desfazer esta exclusão' using errcode = '42501';
  end if;
  if exists (select 1 from public.transactions where id = p_transaction_id) then
    return p_transaction_id;
  end if;

  perform set_config('app.restoring', 'on', true);
  insert into public.transactions
  select * from jsonb_populate_record(null::public.transactions, v_log.old_data);
  perform set_config('app.restoring', 'off', true);
  return p_transaction_id;
end;
$$;
revoke all on function public.restore_deleted_transaction(uuid) from public, anon;
grant execute on function public.restore_deleted_transaction(uuid) to authenticated;

-- Exclusão de conta (0005) liga a flag para o trigger de updated_by.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  if exists (select 1 from public.get_account_deletion_blockers()) then
    raise exception 'Você é dono de uma família com outros membros. Transfira a posse ou exclua a família antes.'
      using errcode = '42501';
  end if;

  perform set_config('app.deleting_account', 'on', true);
  update public.transactions set member_user_id = null where member_user_id = v_uid;
  update public.transactions set updated_by = null where updated_by = v_uid;
  update public.goal_contributions set member_user_id = null where member_user_id = v_uid;
  update public.recurrences set member_user_id = null where member_user_id = v_uid;
  delete from public.workspaces where owner_id = v_uid;
  delete from auth.users where id = v_uid;
  perform set_config('app.deleting_account', 'off', true);
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
