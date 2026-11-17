-- =============================================================================
-- 0007 · Fase 3: camada analítica do dashboard.
-- -----------------------------------------------------------------------------
-- Decisão: ADR-0014 (visões "competência" × "caixa") e ADR-0015 (camada analítica).
-- Regras: docs/requisitos.md RN-60…RN-69.
--
-- Todas as funções são SECURITY INVOKER: rodam com as permissões de quem chama,
-- então a RLS de transactions/card_invoices/... continua valendo. Uma família
-- nunca enxerga agregados de outra (testado em 06_phase3_analytics.test.sql).
--
-- Nada é armazenado: tudo é calculado a partir dos lançamentos na hora.
-- =============================================================================

-- Preferência "ocultar valores" (ícone de olho), salva no perfil.
alter table public.profiles add column hide_amounts boolean not null default false;
comment on column public.profiles.hide_amounts is 'Esconde valores na tela (uso em público).';
grant update (hide_amounts) on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- Correção (bug da Fase 2): a 1ª compra PARCELADA num cartão cuja fatura do
-- ciclo ainda não existia falhava com "first_invoice_month não pode ser nulo".
-- Teste de regressão: 06_phase3_analytics.test.sql e e2e/ledger.spec.ts.
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
  v_first_invoice uuid;
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

  -- Cria/acha a fatura ANTES: dentro de um subselect, a fatura recém-criada
  -- não fica visível (snapshot do comando) e first_invoice_month virava NULL.
  v_first_invoice := private.invoice_for(p_card_id, p_occurred_on);
  insert into public.installment_plans (workspace_id, card_id, description, total_amount_cents, installment_count,
                                        purchase_date, first_invoice_month, category_id)
  values (p_workspace_id, p_card_id, p_description, p_total_cents, p_installments, p_occurred_on,
          (select reference_month from public.card_invoices where id = v_first_invoice),
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

-- Visão de período: competência (padrão) ou caixa/por vencimento.
create type public.analytics_basis as enum ('accrual', 'cash');

-- -----------------------------------------------------------------------------
-- Índices para as consultas analíticas
-- -----------------------------------------------------------------------------
-- Visão caixa: faturas pelo vencimento.
create index card_invoices_ws_due_idx on public.card_invoices (workspace_id, due_date);
-- Saldos (account_balances e saldo em data passada) e limite (credit_card_summaries)
-- somam movimentos por conta/cartão: sem estes índices, viravam varredura completa.
create index transactions_account_idx on public.transactions (account_id) where account_id is not null;
create index transactions_card_idx on public.transactions (card_id) where card_id is not null;
create index transfers_from_idx on public.transfers (from_account_id);
create index transfers_to_idx on public.transfers (to_account_id);
create index invoice_payments_account_idx on public.invoice_payments (account_id) where account_id is not null;
-- Previstos (recorrências não confirmadas): pequenos, consultados a toda hora.
create index transactions_ws_pending_idx on public.transactions (workspace_id, occurred_on)
  where not is_settled;
-- Competência: varredura por espaço+data já coberta por transactions_ws_date_idx (0002).

-- -----------------------------------------------------------------------------
-- Base: lançamentos de um período, já com a "data de impacto" da visão escolhida.
--
--  competência (accrual): data = occurred_on (data da compra/parcela/recebimento).
--  caixa (cash):          crédito → vencimento da fatura; demais → occurred_on.
--
--  previsto (is_planned):
--    competência → não confirmado OU data futura (parcelas futuras).
--    caixa       → crédito: fatura ainda não quitada; demais: igual à competência.
--
--  membro efetivo = member_user_id, ou quem lançou (mesma regra da lista).
-- -----------------------------------------------------------------------------
create or replace function public.analytics_entries(
  p_workspace_id uuid,
  p_from date,
  p_to date,
  p_basis public.analytics_basis default 'accrual',
  p_category_id uuid default null,
  p_member_id uuid default null,
  p_account_id uuid default null,
  p_card_id uuid default null
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
  installment_total smallint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with paid_invoices as (
    -- Só na visão caixa: faturas que vencem no período e se já estão quitadas.
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
  rows as (
    select t.*, t.occurred_on as bucket,
           (not t.is_settled or t.occurred_on > private.today_sp()) as planned
    from public.transactions t
    where t.workspace_id = p_workspace_id
      and t.occurred_on between p_from and p_to
      and (p_basis = 'accrual' or t.payment_method <> 'credit')
    union all
    select t.*, pi.due_date as bucket, not pi.is_paid as planned
    from paid_invoices pi
    join public.transactions t on t.invoice_id = pi.id
  )
  select r.id, r.kind, r.amount_cents, r.bucket, r.occurred_on, r.description,
         r.category_id, coalesce(c.parent_id, c.id), coalesce(r.member_user_id, r.created_by),
         r.payment_method, r.account_id, r.card_id, r.invoice_id, r.planned,
         r.installment_number, r.installment_total
  from rows r
  left join public.categories c on c.id = r.category_id
  where (p_category_id is null or r.category_id = p_category_id or c.parent_id = p_category_id)
    and (p_member_id is null or coalesce(r.member_user_id, r.created_by) = p_member_id)
    and (p_account_id is null or r.account_id = p_account_id)
    and (p_card_id is null or r.card_id = p_card_id)
$$;

-- -----------------------------------------------------------------------------
-- Totais do período (realizado × previsto).
-- -----------------------------------------------------------------------------
create or replace function public.analytics_totals(
  p_workspace_id uuid,
  p_from date,
  p_to date,
  p_basis public.analytics_basis default 'accrual',
  p_category_id uuid default null,
  p_member_id uuid default null,
  p_account_id uuid default null,
  p_card_id uuid default null
)
returns table (
  income_cents bigint,
  income_planned_cents bigint,
  expense_cents bigint,
  expense_planned_cents bigint,
  entries int
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(e.amount_cents) filter (where e.kind = 'income' and not e.is_planned), 0)::bigint,
    coalesce(sum(e.amount_cents) filter (where e.kind = 'income' and e.is_planned), 0)::bigint,
    coalesce(sum(e.amount_cents) filter (where e.kind = 'expense' and not e.is_planned), 0)::bigint,
    coalesce(sum(e.amount_cents) filter (where e.kind = 'expense' and e.is_planned), 0)::bigint,
    count(*)::int
  from public.analytics_entries(p_workspace_id, p_from, p_to, p_basis,
                                p_category_id, p_member_id, p_account_id, p_card_id) e
$$;

-- -----------------------------------------------------------------------------
-- Evolução mês a mês (inclui meses vazios com zero).
-- -----------------------------------------------------------------------------
create or replace function public.analytics_monthly(
  p_workspace_id uuid,
  p_from date,
  p_to date,
  p_basis public.analytics_basis default 'accrual',
  p_category_id uuid default null,
  p_member_id uuid default null,
  p_account_id uuid default null,
  p_card_id uuid default null
)
returns table (
  month date,
  income_cents bigint,
  income_planned_cents bigint,
  expense_cents bigint,
  expense_planned_cents bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with months as (
    select private.add_months(private.month_start(p_from), n) as m
    from generate_series(0, ((extract(year from p_to) - extract(year from p_from)) * 12
                             + extract(month from p_to) - extract(month from p_from))::int) as n
  ),
  agg as (
    select private.month_start(e.bucket_date) as m,
      sum(e.amount_cents) filter (where e.kind = 'income' and not e.is_planned) as inc,
      sum(e.amount_cents) filter (where e.kind = 'income' and e.is_planned) as inc_p,
      sum(e.amount_cents) filter (where e.kind = 'expense' and not e.is_planned) as exp,
      sum(e.amount_cents) filter (where e.kind = 'expense' and e.is_planned) as exp_p
    from public.analytics_entries(p_workspace_id, private.month_start(p_from),
                                  private.add_months(p_to, 1) - 1, p_basis,
                                  p_category_id, p_member_id, p_account_id, p_card_id) e
    group by 1
  )
  select months.m,
         coalesce(agg.inc, 0)::bigint, coalesce(agg.inc_p, 0)::bigint,
         coalesce(agg.exp, 0)::bigint, coalesce(agg.exp_p, 0)::bigint
  from months left join agg on agg.m = months.m
  where p_from <= p_to
  order by months.m
$$;

-- -----------------------------------------------------------------------------
-- Por categoria (folha = subcategoria; parent_id permite somar no pai).
-- category_id nulo = "Sem categoria".
-- -----------------------------------------------------------------------------
create or replace function public.analytics_by_category(
  p_workspace_id uuid,
  p_from date,
  p_to date,
  p_basis public.analytics_basis default 'accrual',
  p_kind public.transaction_kind default 'expense',
  p_category_id uuid default null,
  p_member_id uuid default null,
  p_account_id uuid default null,
  p_card_id uuid default null
)
returns table (
  category_id uuid,
  parent_id uuid,
  total_cents bigint,
  planned_cents bigint,
  entries int
)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.category_id,
         case when e.root_category_id is distinct from e.category_id then e.root_category_id end,
         sum(e.amount_cents)::bigint,
         coalesce(sum(e.amount_cents) filter (where e.is_planned), 0)::bigint,
         count(*)::int
  from public.analytics_entries(p_workspace_id, p_from, p_to, p_basis,
                                p_category_id, p_member_id, p_account_id, p_card_id) e
  where e.kind = p_kind
  group by e.category_id, e.root_category_id
  order by 3 desc
$$;

-- -----------------------------------------------------------------------------
-- Por membro da família (membro efetivo).
-- -----------------------------------------------------------------------------
create or replace function public.analytics_by_member(
  p_workspace_id uuid,
  p_from date,
  p_to date,
  p_basis public.analytics_basis default 'accrual',
  p_category_id uuid default null,
  p_member_id uuid default null,
  p_account_id uuid default null,
  p_card_id uuid default null
)
returns table (member_id uuid, income_cents bigint, expense_cents bigint, entries int)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.member_id,
         coalesce(sum(e.amount_cents) filter (where e.kind = 'income'), 0)::bigint,
         coalesce(sum(e.amount_cents) filter (where e.kind = 'expense'), 0)::bigint,
         count(*)::int
  from public.analytics_entries(p_workspace_id, p_from, p_to, p_basis,
                                p_category_id, p_member_id, p_account_id, p_card_id) e
  group by e.member_id
  order by 3 desc
$$;

-- -----------------------------------------------------------------------------
-- Por meio de pagamento: cartão (card) ou conta (account); 'none' = sem conta.
-- -----------------------------------------------------------------------------
create or replace function public.analytics_by_source(
  p_workspace_id uuid,
  p_from date,
  p_to date,
  p_basis public.analytics_basis default 'accrual',
  p_category_id uuid default null,
  p_member_id uuid default null,
  p_account_id uuid default null,
  p_card_id uuid default null
)
returns table (source_type text, source_id uuid, expense_cents bigint, income_cents bigint, entries int)
language sql
stable
security invoker
set search_path = ''
as $$
  select case when e.card_id is not null then 'card'
              when e.account_id is not null then 'account'
              else 'none' end,
         coalesce(e.card_id, e.account_id),
         coalesce(sum(e.amount_cents) filter (where e.kind = 'expense'), 0)::bigint,
         coalesce(sum(e.amount_cents) filter (where e.kind = 'income'), 0)::bigint,
         count(*)::int
  from public.analytics_entries(p_workspace_id, p_from, p_to, p_basis,
                                p_category_id, p_member_id, p_account_id, p_card_id) e
  group by 1, 2
  order by 3 desc
$$;

-- -----------------------------------------------------------------------------
-- Posição financeira até p_until (independe da visão e de categoria/membro).
--
--  p_until no passado → saldo das contas naquele dia (realizado), sem projeção.
--  p_until hoje/futuro → SALDO PROJETADO = saldo atual
--                         + receitas previstas (não confirmadas, até p_until)
--                         − despesas previstas fora do cartão (até p_until)
--                         − faturas a vencer/vencidas não quitadas (até p_until).
--  As compras no cartão entram só pela fatura (nunca duas vezes).
--  Filtro de conta → só aquela conta, sem faturas. Filtro de cartão → só as
--  faturas e o limite daquele cartão.
-- -----------------------------------------------------------------------------
create or replace function public.analytics_position(
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
  -- Saldo realizado em p_until (só usado quando p_until < hoje).
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
                  where p.account_id in (select id from accts) and p.paid_on <= p_until), 0))::bigint as v
    from accts a
  ),
  current_balance as (
    select coalesce(sum(b.balance_cents), 0)::bigint as v
    from public.account_balances b
    where b.account_id in (select id from accts)
  ),
  planned as (
    select
      coalesce(sum(t.amount_cents) filter (where t.kind = 'income'), 0)::bigint as inc,
      coalesce(sum(t.amount_cents) filter (where t.kind = 'expense'), 0)::bigint as exp
    from public.transactions t
    where t.workspace_id = p_workspace_id
      and not t.is_settled
      and t.payment_method <> 'credit'
      and t.occurred_on <= p_until
      and (p_account_id is null or t.account_id = p_account_id)
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
    -- Em aberto = fechadas/vencidas não quitadas + a fatura corrente de cada cartão.
    select coalesce(sum(i.remaining_cents), 0)::bigint as v
    from invoices i, today
    where i.closing_date <= today.d
       or i.closing_date = (select min(ci.closing_date) from public.card_invoices ci
                            where ci.card_id = i.card_id and ci.closing_date > today.d)
  ),
  due_inv as (
    select coalesce(sum(i.remaining_cents), 0)::bigint as v
    from invoices i
    where i.due_date <= p_until and p_account_id is null
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
    case when p_until < today.d then 0 else due_inv.v end,
    limits.lim,
    limits.avail,
    case when p_until < today.d then 0 else planned.inc end,
    case when p_until < today.d then 0 else planned.exp end,
    case when p_until < today.d then past_balance.v
         else current_balance.v + planned.inc - planned.exp - due_inv.v end,
    p_until >= today.d
  from today, past_balance, current_balance, planned, open_inv, due_inv, limits
$$;

-- -----------------------------------------------------------------------------
-- Próximos vencimentos: contas a pagar (previstas, fora do cartão) e faturas
-- não quitadas que vencem até hoje + p_days. Inclui as já vencidas.
-- -----------------------------------------------------------------------------
create or replace function public.analytics_upcoming(p_workspace_id uuid, p_days int default 15)
returns table (
  item_type text,
  ref_id uuid,
  due_on date,
  description text,
  amount_cents bigint,
  category_id uuid,
  card_id uuid,
  account_id uuid,
  is_overdue boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with today as (select private.today_sp() as d)
  select 'bill', t.id, t.occurred_on, t.description, t.amount_cents, t.category_id, null::uuid, t.account_id,
         t.occurred_on < today.d
  from public.transactions t, today
  where t.workspace_id = p_workspace_id
    and not t.is_settled
    and t.kind = 'expense'
    and t.payment_method <> 'credit'
    and t.occurred_on <= today.d + greatest(least(p_days, 90), 0)
  union all
  select 'invoice', s.invoice_id, s.due_date, c.name, s.remaining_cents, null, s.card_id, null,
         s.due_date < today.d
  from public.card_invoice_summaries s
  join public.credit_cards c on c.id = s.card_id
  cross join today
  where s.workspace_id = p_workspace_id
    and s.remaining_cents > 0
    and s.due_date <= today.d + greatest(least(p_days, 90), 0)
  order by 3, 5 desc
$$;

-- -----------------------------------------------------------------------------
-- Permissões: só usuários logados (a RLS faz o resto).
-- -----------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.analytics_entries(uuid, date, date, public.analytics_basis, uuid, uuid, uuid, uuid)',
    'public.analytics_totals(uuid, date, date, public.analytics_basis, uuid, uuid, uuid, uuid)',
    'public.analytics_monthly(uuid, date, date, public.analytics_basis, uuid, uuid, uuid, uuid)',
    'public.analytics_by_category(uuid, date, date, public.analytics_basis, public.transaction_kind, uuid, uuid, uuid, uuid)',
    'public.analytics_by_member(uuid, date, date, public.analytics_basis, uuid, uuid, uuid, uuid)',
    'public.analytics_by_source(uuid, date, date, public.analytics_basis, uuid, uuid, uuid, uuid)',
    'public.analytics_position(uuid, date, uuid, uuid)',
    'public.analytics_upcoming(uuid, int)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;
