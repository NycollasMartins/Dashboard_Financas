-- =============================================================================
-- 0002 · Domínio financeiro
-- -----------------------------------------------------------------------------
-- Regras transversais:
--   * Dinheiro SEMPRE em centavos (bigint). Nunca float/numeric para valores.
--   * Datas de competência em `date` (fuso America/Sao_Paulo resolvido na app).
--   * Toda tabela tem workspace_id e FKs COMPOSTAS (id, workspace_id), o que
--     torna impossível, no nível do banco, uma transação apontar para um cartão
--     ou categoria de OUTRO espaço.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.transaction_kind as enum ('income', 'expense');
create type public.payment_method as enum ('pix', 'debit', 'credit', 'cash', 'transfer', 'boleto', 'other');
create type public.account_type as enum ('checking', 'savings', 'wallet', 'investment', 'other');
create type public.invoice_status as enum ('open', 'closed', 'paid');
create type public.entry_source as enum ('manual', 'recurrence', 'import', 'whatsapp', 'telegram');
create type public.goal_status as enum ('active', 'achieved', 'archived');
create type public.import_format as enum ('csv', 'ofx');
create type public.import_status as enum ('pending', 'processed', 'failed', 'reverted');

-- -----------------------------------------------------------------------------
-- accounts (contas bancárias / carteira)
-- -----------------------------------------------------------------------------
create table public.accounts (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  name                  text not null check (char_length(btrim(name)) between 1 and 60),
  type                  public.account_type not null default 'checking',
  institution           text check (char_length(institution) <= 60),
  initial_balance_cents bigint not null default 0,
  owner_user_id         uuid references auth.users (id) on delete set null,
  color                 text check (color ~ '^#[0-9a-fA-F]{6}$'),
  archived_at           timestamptz,
  created_by            uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (id, workspace_id)
);
create unique index accounts_name_uq on public.accounts (workspace_id, lower(name)) where archived_at is null;

-- -----------------------------------------------------------------------------
-- credit_cards
-- -----------------------------------------------------------------------------
create table public.credit_cards (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 40),
  brand         text check (char_length(brand) <= 30),
  last4         char(4) check (last4 ~ '^[0-9]{4}$'),
  limit_cents   bigint check (limit_cents >= 0),
  -- Dia 29-31 em meses curtos = último dia do mês (regra na aplicação).
  closing_day   smallint not null check (closing_day between 1 and 31),
  due_day       smallint not null check (due_day between 1 and 31),
  owner_user_id uuid references auth.users (id) on delete set null,
  color         text check (color ~ '^#[0-9a-fA-F]{6}$'),
  archived_at   timestamptz,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, workspace_id)
);
create unique index credit_cards_name_uq on public.credit_cards (workspace_id, lower(name)) where archived_at is null;

-- -----------------------------------------------------------------------------
-- card_invoices (faturas). reference_month = 1º dia do mês de VENCIMENTO.
-- -----------------------------------------------------------------------------
create table public.card_invoices (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null,
  card_id              uuid not null,
  reference_month      date not null check (extract(day from reference_month) = 1),
  closing_date         date not null,
  due_date             date not null,
  status               public.invoice_status not null default 'open',
  paid_at              timestamptz,
  paid_amount_cents    bigint check (paid_amount_cents >= 0),
  paid_from_account_id uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (card_id, reference_month),
  unique (id, workspace_id),
  unique (id, card_id),
  check (closing_date < due_date),
  check ((status = 'paid') = (paid_at is not null)),
  foreign key (card_id, workspace_id) references public.credit_cards (id, workspace_id) on delete cascade,
  foreign key (paid_from_account_id, workspace_id) references public.accounts (id, workspace_id)
    on delete set null (paid_from_account_id)
);
create index card_invoices_ws_idx on public.card_invoices (workspace_id, reference_month);

-- -----------------------------------------------------------------------------
-- categories (padrões copiados para cada espaço; personalizáveis)
-- -----------------------------------------------------------------------------
create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind         public.transaction_kind not null,
  name         text not null check (char_length(btrim(name)) between 1 and 40),
  icon         text not null default 'circle' check (icon ~ '^[a-z0-9-]{1,40}$'),
  color        text not null default '#94a3b8' check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_default   boolean not null default false,
  sort_order   smallint not null default 0,
  archived_at  timestamptz,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, workspace_id)
);
create unique index categories_name_uq on public.categories (workspace_id, kind, lower(name));

-- -----------------------------------------------------------------------------
-- recurrences (receitas e despesas fixas mensais → geram transações)
-- -----------------------------------------------------------------------------
create table public.recurrences (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces (id) on delete cascade,
  kind                 public.transaction_kind not null,
  description          text not null check (char_length(btrim(description)) between 1 and 140),
  amount_cents         bigint not null check (amount_cents > 0),
  category_id          uuid,
  payment_method       public.payment_method not null default 'pix',
  account_id           uuid,
  card_id              uuid,
  member_user_id       uuid references auth.users (id) on delete set null,
  day_of_month         smallint not null check (day_of_month between 1 and 31),
  starts_on            date not null,
  ends_on              date,
  is_active            boolean not null default true,
  last_generated_month date check (last_generated_month is null or extract(day from last_generated_month) = 1),
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (id, workspace_id),
  check (ends_on is null or ends_on >= starts_on),
  check ((payment_method = 'credit') = (card_id is not null)),
  check (kind = 'expense' or payment_method <> 'credit'),
  foreign key (category_id, workspace_id) references public.categories (id, workspace_id) on delete set null (category_id),
  foreign key (account_id, workspace_id) references public.accounts (id, workspace_id) on delete set null (account_id),
  foreign key (card_id, workspace_id) references public.credit_cards (id, workspace_id) on delete restrict
);
create index recurrences_ws_idx on public.recurrences (workspace_id) where is_active;

-- -----------------------------------------------------------------------------
-- installment_plans (compra parcelada no cartão)
-- -----------------------------------------------------------------------------
create table public.installment_plans (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  card_id             uuid not null,
  description         text not null check (char_length(btrim(description)) between 1 and 140),
  total_amount_cents  bigint not null check (total_amount_cents > 0),
  installment_count   smallint not null check (installment_count between 2 and 48),
  purchase_date       date not null,
  first_invoice_month date not null check (extract(day from first_invoice_month) = 1),
  category_id         uuid,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, workspace_id),
  check (total_amount_cents >= installment_count),
  foreign key (card_id, workspace_id) references public.credit_cards (id, workspace_id) on delete restrict,
  foreign key (category_id, workspace_id) references public.categories (id, workspace_id) on delete set null (category_id)
);

-- -----------------------------------------------------------------------------
-- import_batches (importação CSV/OFX)
-- -----------------------------------------------------------------------------
create table public.import_batches (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  format         public.import_format not null,
  file_name      text not null check (char_length(file_name) <= 200),
  account_id     uuid,
  card_id        uuid,
  status         public.import_status not null default 'pending',
  total_rows     integer not null default 0 check (total_rows >= 0),
  imported_rows  integer not null default 0 check (imported_rows >= 0),
  duplicate_rows integer not null default 0 check (duplicate_rows >= 0),
  error_message  text check (char_length(error_message) <= 500),
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (id, workspace_id),
  check (num_nonnulls(account_id, card_id) <= 1),
  foreign key (account_id, workspace_id) references public.accounts (id, workspace_id) on delete set null (account_id),
  foreign key (card_id, workspace_id) references public.credit_cards (id, workspace_id) on delete set null (card_id)
);

-- -----------------------------------------------------------------------------
-- goals (metas) e goal_contributions (aportes)
-- -----------------------------------------------------------------------------
create table public.goals (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 60),
  target_cents bigint not null check (target_cents > 0),
  target_date  date,
  icon         text not null default 'target' check (icon ~ '^[a-z0-9-]{1,40}$'),
  color        text not null default '#5eead4' check (color ~ '^#[0-9a-fA-F]{6}$'),
  status       public.goal_status not null default 'active',
  achieved_at  timestamptz,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, workspace_id)
);
create unique index goals_name_uq on public.goals (workspace_id, lower(name)) where status <> 'archived';

create table public.goal_contributions (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null,
  goal_id        uuid not null,
  -- Positivo = aporte; negativo = resgate.
  amount_cents   bigint not null check (amount_cents <> 0),
  contributed_on date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  account_id     uuid,
  note           text check (char_length(note) <= 200),
  source         public.entry_source not null default 'manual',
  member_user_id uuid references auth.users (id) on delete set null,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  foreign key (goal_id, workspace_id) references public.goals (id, workspace_id) on delete cascade,
  foreign key (account_id, workspace_id) references public.accounts (id, workspace_id) on delete set null (account_id)
);
create index goal_contributions_goal_idx on public.goal_contributions (goal_id, contributed_on);
create index goal_contributions_ws_idx on public.goal_contributions (workspace_id, contributed_on);

-- -----------------------------------------------------------------------------
-- transactions (o coração do sistema)
-- -----------------------------------------------------------------------------
create table public.transactions (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  kind                public.transaction_kind not null,
  amount_cents        bigint not null check (amount_cents > 0),
  description         text not null check (char_length(btrim(description)) between 1 and 140),
  -- Data da compra/recebimento (competência). Para crédito, o mês de impacto no
  -- caixa vem da fatura (invoice_id).
  occurred_on         date not null,
  category_id         uuid,
  payment_method      public.payment_method not null,
  account_id          uuid,
  card_id             uuid,
  invoice_id          uuid,
  installment_plan_id uuid,
  installment_number  smallint,
  installment_total   smallint,
  recurrence_id       uuid,
  recurrence_month    date,
  import_batch_id     uuid,
  -- Hash normalizado (data+valor+descrição+origem) para detectar duplicatas na importação.
  dedupe_hash         text check (char_length(dedupe_hash) <= 128),
  -- Quem gastou/recebeu (útil no espaço familiar e para salários).
  member_user_id      uuid references auth.users (id) on delete set null,
  source              public.entry_source not null default 'manual',
  -- false = previsto/a pagar (ex.: despesa fixa gerada para o mês, ainda não paga).
  is_settled          boolean not null default true,
  notes               text check (char_length(notes) <= 500),
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (id, workspace_id),
  -- Crédito ⇔ tem cartão e fatura.
  check ((payment_method = 'credit') = (card_id is not null)),
  check ((card_id is null) = (invoice_id is null)),
  -- Receitas não entram em cartão de crédito (estornos: fase 7).
  check (kind = 'expense' or payment_method <> 'credit'),
  -- Parcelamento consistente.
  check ((installment_plan_id is null) = (installment_number is null)),
  check ((installment_number is null) = (installment_total is null)),
  check (installment_number is null or installment_number between 1 and installment_total),
  check (installment_plan_id is null or payment_method = 'credit'),
  -- Recorrência: mês de referência sempre dia 1. Se a recorrência for excluída,
  -- recurrence_id vira NULL e recurrence_month fica como histórico.
  check (recurrence_id is null or recurrence_month is not null),
  check (recurrence_month is null or extract(day from recurrence_month) = 1),

  foreign key (category_id, workspace_id) references public.categories (id, workspace_id) on delete set null (category_id),
  foreign key (account_id, workspace_id) references public.accounts (id, workspace_id) on delete set null (account_id),
  foreign key (card_id, workspace_id) references public.credit_cards (id, workspace_id) on delete restrict,
  foreign key (invoice_id, card_id) references public.card_invoices (id, card_id) on delete restrict,
  foreign key (installment_plan_id, workspace_id) references public.installment_plans (id, workspace_id) on delete cascade,
  foreign key (recurrence_id, workspace_id) references public.recurrences (id, workspace_id) on delete set null (recurrence_id),
  foreign key (import_batch_id, workspace_id) references public.import_batches (id, workspace_id) on delete set null (import_batch_id)
);

-- Idempotência da geração automática: uma transação por recorrência por mês.
create unique index transactions_recurrence_month_uq on public.transactions (recurrence_id, recurrence_month)
  where recurrence_id is not null;
-- Uma parcela de cada número por plano.
create unique index transactions_installment_uq on public.transactions (installment_plan_id, installment_number)
  where installment_plan_id is not null;
create unique index transactions_dedupe_uq on public.transactions (workspace_id, dedupe_hash)
  where dedupe_hash is not null;
create index transactions_ws_date_idx on public.transactions (workspace_id, occurred_on desc);
create index transactions_ws_cat_date_idx on public.transactions (workspace_id, category_id, occurred_on);
create index transactions_invoice_idx on public.transactions (invoice_id) where invoice_id is not null;
create index transactions_created_by_idx on public.transactions (created_by, created_at desc);

-- -----------------------------------------------------------------------------
-- Validações que FKs não cobrem
-- -----------------------------------------------------------------------------
create or replace function private.validate_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cat_kind public.transaction_kind;
  -- Lemos via jsonb porque o mesmo trigger serve tabelas com colunas diferentes.
  v_json jsonb := to_jsonb(new);
  v_ws uuid := (v_json ->> 'workspace_id')::uuid;
begin
  -- Categoria precisa ser do mesmo tipo (receita/despesa).
  if (v_json ->> 'category_id') is not null and v_json ? 'kind' then
    select c.kind into v_cat_kind from public.categories c where c.id = (v_json ->> 'category_id')::uuid;
    if v_cat_kind is distinct from (v_json ->> 'kind')::public.transaction_kind then
      raise exception 'Categoria incompatível com o tipo do lançamento' using errcode = '23514';
    end if;
  end if;

  -- member_user_id / owner_user_id precisam ser membros do espaço.
  if (v_json ->> 'member_user_id') is not null
     and not private.user_is_member(v_ws, (v_json ->> 'member_user_id')::uuid) then
    raise exception 'A pessoa indicada não é membro deste espaço' using errcode = '23514';
  end if;
  if (v_json ->> 'owner_user_id') is not null
     and not private.user_is_member(v_ws, (v_json ->> 'owner_user_id')::uuid) then
    raise exception 'O titular indicado não é membro deste espaço' using errcode = '23514';
  end if;

  return new;
end;
$$;
revoke all on function private.validate_entry() from public;

-- -----------------------------------------------------------------------------
-- Triggers padrão + RLS padrão para todas as tabelas do domínio
-- -----------------------------------------------------------------------------
-- Matriz de permissões (ver docs/requisitos.md §Papéis):
--   SELECT/INSERT/UPDATE: qualquer membro do espaço.
--   DELETE: admin do espaço OU quem criou o registro.
--   transactions/goal_contributions UPDATE: admin OU quem criou.
do $$
declare
  t text;
  has_updated_at boolean;
  has_created_by boolean;
begin
  foreach t in array array[
    'accounts', 'credit_cards', 'card_invoices', 'categories', 'recurrences',
    'installment_plans', 'import_batches', 'goals', 'goal_contributions', 'transactions'
  ] loop
    select exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = t and column_name = 'updated_at')
      into has_updated_at;
    select exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = t and column_name = 'created_by')
      into has_created_by;

    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke truncate, references, trigger on public.%I from authenticated', t);

    if has_updated_at then
      execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
                     t || '_updated_at', t);
    end if;
    if has_created_by then
      execute format('create trigger %I before insert on public.%I for each row execute function private.set_created_by()',
                     t || '_created_by', t);
    end if;
    execute format('create trigger %I before update on public.%I for each row execute function private.protect_ownership_columns()',
                   t || '_protect', t);

    execute format($p$create policy %I on public.%I for select to authenticated
                      using (workspace_id in (select private.my_workspace_ids()))$p$, t || '_select', t);
    execute format($p$create policy %I on public.%I for insert to authenticated
                      with check (workspace_id in (select private.my_workspace_ids()))$p$, t || '_insert', t);

    if t in ('transactions', 'goal_contributions') then
      execute format($p$create policy %I on public.%I for update to authenticated
                        using (workspace_id in (select private.my_workspace_ids())
                               and (created_by = (select auth.uid()) or private.is_admin(workspace_id)))
                        with check (workspace_id in (select private.my_workspace_ids()))$p$, t || '_update', t);
    else
      execute format($p$create policy %I on public.%I for update to authenticated
                        using (workspace_id in (select private.my_workspace_ids()))
                        with check (workspace_id in (select private.my_workspace_ids()))$p$, t || '_update', t);
    end if;

    if has_created_by then
      execute format($p$create policy %I on public.%I for delete to authenticated
                        using (workspace_id in (select private.my_workspace_ids())
                               and (created_by = (select auth.uid()) or private.is_admin(workspace_id)))$p$, t || '_delete', t);
    else
      -- card_invoices: só admin exclui.
      execute format($p$create policy %I on public.%I for delete to authenticated
                        using (private.is_admin(workspace_id))$p$, t || '_delete', t);
    end if;
  end loop;
end;
$$;

create trigger transactions_validate before insert or update on public.transactions
  for each row execute function private.validate_entry();
create trigger recurrences_validate before insert or update on public.recurrences
  for each row execute function private.validate_entry();
create trigger goal_contributions_validate before insert or update on public.goal_contributions
  for each row execute function private.validate_entry();
create trigger accounts_validate before insert or update on public.accounts
  for each row execute function private.validate_entry();
create trigger credit_cards_validate before insert or update on public.credit_cards
  for each row execute function private.validate_entry();

-- -----------------------------------------------------------------------------
-- Categorias padrão: copiadas para cada novo espaço (pessoal ou familiar).
-- -----------------------------------------------------------------------------
create or replace function private.seed_default_categories(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categories (workspace_id, kind, name, icon, color, is_default, sort_order)
  values
    (p_workspace_id, 'expense', 'Moradia',             'house',           '#60a5fa', true, 10),
    (p_workspace_id, 'expense', 'Mercado',             'shopping-cart',   '#34d399', true, 20),
    (p_workspace_id, 'expense', 'Restaurantes e delivery', 'utensils',    '#fb923c', true, 30),
    (p_workspace_id, 'expense', 'Transporte',          'car',             '#facc15', true, 40),
    (p_workspace_id, 'expense', 'Contas e serviços',   'receipt',         '#a78bfa', true, 50),
    (p_workspace_id, 'expense', 'Assinaturas',         'repeat',          '#f472b6', true, 60),
    (p_workspace_id, 'expense', 'Saúde',               'heart-pulse',     '#f87171', true, 70),
    (p_workspace_id, 'expense', 'Educação',            'graduation-cap',  '#38bdf8', true, 80),
    (p_workspace_id, 'expense', 'Lazer',               'party-popper',    '#c084fc', true, 90),
    (p_workspace_id, 'expense', 'Compras',             'shopping-bag',    '#fbbf24', true, 100),
    (p_workspace_id, 'expense', 'Cuidados pessoais',   'sparkles',        '#f9a8d4', true, 110),
    (p_workspace_id, 'expense', 'Pets',                'paw-print',       '#a3e635', true, 120),
    (p_workspace_id, 'expense', 'Viagem',              'plane',           '#22d3ee', true, 130),
    (p_workspace_id, 'expense', 'Presentes e doações', 'gift',            '#e879f9', true, 140),
    (p_workspace_id, 'expense', 'Impostos e taxas',    'landmark',        '#94a3b8', true, 150),
    (p_workspace_id, 'expense', 'Outros',              'ellipsis',        '#64748b', true, 999),
    (p_workspace_id, 'income',  'Salário',             'briefcase',       '#5eead4', true, 10),
    (p_workspace_id, 'income',  'Freelance',           'laptop',          '#4ade80', true, 20),
    (p_workspace_id, 'income',  'Presentes',           'gift',            '#f0abfc', true, 30),
    (p_workspace_id, 'income',  'Rendimentos',         'trending-up',     '#86efac', true, 40),
    (p_workspace_id, 'income',  'Reembolsos',          'rotate-ccw',      '#93c5fd', true, 50),
    (p_workspace_id, 'income',  'Outras receitas',     'circle-plus',     '#64748b', true, 999)
  on conflict do nothing;
end;
$$;
revoke all on function private.seed_default_categories(uuid) from public;

create or replace function private.on_workspace_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_default_categories(new.id);
  return new;
end;
$$;
revoke all on function private.on_workspace_created() from public;

create trigger workspaces_seed_categories after insert on public.workspaces
  for each row execute function private.on_workspace_created();
