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

-- =============================================================================
-- DADOS DE DEMONSTRAÇÃO (Fase 2) — família "Casa Teste" da Ana.
-- Datas relativas a HOJE: o mês atual e o anterior sempre têm dados.
-- Os lançamentos são feitos "como a Ana" (auth.uid() simulado) para que a
-- autoria e as regras do banco funcionem exatamente como no app.
-- =============================================================================
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', false);

do $$
declare
  ws uuid := (select id from public.workspaces where name = 'Casa Teste');
  ana uuid := 'a0000000-0000-4000-8000-000000000001';
  m0 date := private.month_start(private.today_sp());     -- 1º dia do mês atual
  m1 date := private.add_months(private.today_sp(), -1);  -- 1º dia do mês anterior
  today date := private.today_sp();
  acc_nu uuid; acc_wallet uuid; acc_save uuid; card_nu uuid; card_inter uuid;
  cat uuid;
  d date;
begin
  update public.profiles set last_workspace_id = ws where id = ana;

  insert into public.accounts (workspace_id, name, type, institution, initial_balance_cents, color)
  values (ws, 'Conta Nubank', 'checking', 'Nubank', 320000, '#8b5cf6') returning id into acc_nu;
  insert into public.accounts (workspace_id, name, type, initial_balance_cents, color)
  values (ws, 'Carteira', 'wallet', 15000, '#facc15') returning id into acc_wallet;
  insert into public.accounts (workspace_id, name, type, institution, initial_balance_cents, color)
  values (ws, 'Poupança', 'savings', 'Inter', 850000, '#4ade80') returning id into acc_save;

  insert into public.credit_cards (workspace_id, name, brand, last4, limit_cents, closing_day, due_day, color)
  values (ws, 'Nubank', 'Mastercard', '4821', 800000, 3, 10, '#8b5cf6') returning id into card_nu;
  insert into public.credit_cards (workspace_id, name, brand, last4, limit_cents, closing_day, due_day, color)
  values (ws, 'Inter', 'Mastercard', '1190', 300000, 25, 5, '#fb923c') returning id into card_inter;

  -- Recorrências (o trigger gera do início até o fim do mês atual)
  insert into public.recurrences (workspace_id, kind, description, amount_cents, category_id, payment_method, account_id, member_user_id, day_of_month, starts_on, auto_confirm)
  values
    (ws, 'income', 'Salário Ana', 650000, (select id from public.categories where workspace_id = ws and name = 'Salário'), 'transfer', acc_nu, ana, 5, m1, false),
    (ws, 'expense', 'Aluguel', 220000, (select id from public.categories where workspace_id = ws and name = 'Moradia'), 'pix', acc_nu, null, 10, m1, false),
    (ws, 'expense', 'Internet', 11990, (select id from public.categories where workspace_id = ws and name = 'Contas e serviços'), 'boleto', acc_nu, null, 15, m1, false),
    (ws, 'expense', 'Luz', 18740, (select id from public.categories where workspace_id = ws and name = 'Contas e serviços'), 'pix', acc_nu, null, 20, m1, false),
    (ws, 'expense', 'Academia', 12990, (select id from public.categories where workspace_id = ws and name = 'Saúde'), 'debit', acc_nu, ana, 5, m1, false);
  insert into public.recurrences (workspace_id, kind, description, amount_cents, category_id, payment_method, card_id, day_of_month, starts_on, auto_confirm)
  values
    (ws, 'expense', 'Netflix', 5590, (select id from public.categories where workspace_id = ws and name = 'Assinaturas'), 'credit', card_nu, 8, m1, true),
    (ws, 'expense', 'Spotify', 2190, (select id from public.categories where workspace_id = ws and name = 'Assinaturas'), 'credit', card_inter, 12, m1, true);

  -- O que já passou está pago/recebido; o resto do mês fica "previsto".
  update public.transactions set is_settled = true where workspace_id = ws and recurrence_id is not null and occurred_on <= today;

  -- Receita eventual
  insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on, category_id, payment_method, account_id, member_user_id)
  values (ws, 'income', 120000, 'Freela – site da padaria', m1 + 17, (select id from public.categories where workspace_id = ws and name = 'Freelance'), 'pix', acc_nu, ana);

  -- Gastos variáveis do mês anterior e do atual (até hoje)
  for d in select generate_series(m1, today, interval '3 days')::date loop
    insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on, category_id, payment_method, account_id)
    values (ws, 'expense', 18000 + (extract(day from d)::int * 731) % 22000, 'Mercado', d,
            (select id from public.categories where workspace_id = ws and name = 'Mercado'), 'debit', acc_nu);
  end loop;
  for d in select generate_series(m1 + 1, today, interval '5 days')::date loop
    perform public.create_card_purchase(ws, card_nu, 2190 + (extract(day from d)::int * 377) % 3500, 1, 'Uber', d,
            (select id from public.categories where workspace_id = ws and name = 'Transporte'));
    perform public.create_card_purchase(ws, card_inter, 4590 + (extract(day from d)::int * 911) % 6000, 1, 'iFood', d + 1,
            (select id from public.categories where workspace_id = ws and name = 'Restaurantes e delivery'));
  end loop;
  insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on, category_id, payment_method, account_id)
  values
    (ws, 'expense', 3500, 'Padaria', today, (select id from public.categories where workspace_id = ws and name = 'Mercado'), 'cash', acc_wallet),
    (ws, 'expense', 8990, 'Farmácia', greatest(m0, today - 2), (select id from public.categories where workspace_id = ws and name = 'Saúde'), 'pix', acc_nu),
    (ws, 'expense', 15000, 'Cinema e jantar', m1 + 20, (select id from public.categories where workspace_id = ws and name = 'Lazer'), 'pix', acc_nu);

  -- Compra parcelada: notebook em 10x no Nubank (começou no mês anterior)
  perform public.create_card_purchase(ws, card_nu, 499990, 10, 'Notebook', m1 + 13,
          (select id from public.categories where workspace_id = ws and name = 'Compras'));
  -- Celular em 6x no Inter
  perform public.create_card_purchase(ws, card_inter, 179900, 6, 'Celular novo', m1 + 2,
          (select id from public.categories where workspace_id = ws and name = 'Compras'));

  -- Transferência para a poupança
  insert into public.transfers (workspace_id, from_account_id, to_account_id, amount_cents, occurred_on, description)
  values (ws, acc_nu, acc_save, 50000, m1 + 6, 'Reserva do mês');

  -- Paga as faturas já vencidas (total exato)
  insert into public.invoice_payments (workspace_id, invoice_id, account_id, amount_cents, paid_on)
  select ws, s.invoice_id, acc_nu, s.total_cents, s.due_date
  from public.card_invoice_summaries s
  where s.workspace_id = ws and s.due_date < today and s.total_cents > 0;
end $$;

select set_config('request.jwt.claims', '', false);
