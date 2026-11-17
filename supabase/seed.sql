-- =============================================================================
-- SEED · SOMENTE DESENVOLVIMENTO LOCAL (roda em `supabase db reset`).
-- NUNCA rode isto em produção.
--
-- Usuários de teste (e-mail já confirmado), senha de ambos: Teste12345
--   ana@teste.local    → dona da família "Casa Teste"
--   bruno@teste.local  → sem família (use para testar convites)
--   caio@teste.local   → membro da família "Casa Teste" (gráfico por membro)
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
   '{"provider":"email","providers":["email"]}', '{"full_name":"Bruno Teste"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'caio@teste.local', extensions.crypt('Teste12345', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Caio Teste"}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email in ('ana@teste.local', 'bruno@teste.local', 'caio@teste.local');

-- Família da Ana (o trigger adiciona a dona como admin e cria as categorias).
insert into public.workspaces (kind, name, owner_id)
values ('household', 'Casa Teste', 'a0000000-0000-4000-8000-000000000001');

-- Caio entra na família como membro comum (no app isso acontece pelo convite).
insert into public.workspace_members (workspace_id, user_id, role)
select id, 'c0000000-0000-4000-8000-000000000003', 'member' from public.workspaces where name = 'Casa Teste';
update public.profiles set last_workspace_id = (select id from public.workspaces where name = 'Casa Teste')
where id = 'c0000000-0000-4000-8000-000000000003';

-- =============================================================================
-- DADOS DE DEMONSTRAÇÃO (Fases 2, 3 e 4) — família "Casa Teste" (Ana + Caio).
-- 12 meses de histórico com datas RELATIVAS a hoje, para os gráficos fazerem
-- sentido em qualquer dia: salários, contas fixas, mercado, cartões, parcelas,
-- freelas eventuais e um mês atípico (conserto do carro, 4 meses atrás).
-- Valores variam com random() de semente fixa → o seed é reproduzível.
-- Os lançamentos são feitos "como a Ana" (auth.uid() simulado) para que a
-- autoria e as regras do banco funcionem exatamente como no app.
-- =============================================================================
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', false);
select setseed(0.42);

do $$
declare
  ws uuid := (select id from public.workspaces where name = 'Casa Teste');
  ana uuid := 'a0000000-0000-4000-8000-000000000001';
  caio uuid := 'c0000000-0000-4000-8000-000000000003';
  today date := private.today_sp();
  m0 date := private.month_start(private.today_sp());   -- 1º dia do mês atual
  start date := private.add_months(private.today_sp(), -11); -- 1º dia, 11 meses atrás
  acc_nu uuid; acc_wallet uuid; acc_save uuid; card_nu uuid; card_inter uuid;
  c_mercado uuid; c_rest uuid; c_transp uuid; c_saude uuid; c_lazer uuid; c_compras uuid;
  c_cuidados uuid; c_pets uuid; c_viagem uuid; c_presentes uuid; c_freela uuid; c_salario uuid;
  r_luz uuid;
  g_carro uuid; g_viagem uuid; g_reserva uuid;
  carro_aportes int[] := array[150000, 0, 250000, 80000, 300000, 120000, 200000];
  d date;
  m date;
  n int;
  k int;
  boost numeric;
begin
  select id into c_mercado  from public.categories where workspace_id = ws and name = 'Mercado';
  select id into c_rest     from public.categories where workspace_id = ws and name = 'Restaurantes e delivery';
  select id into c_transp   from public.categories where workspace_id = ws and name = 'Transporte';
  select id into c_saude    from public.categories where workspace_id = ws and name = 'Saúde';
  select id into c_lazer    from public.categories where workspace_id = ws and name = 'Lazer';
  select id into c_compras  from public.categories where workspace_id = ws and name = 'Compras';
  select id into c_cuidados from public.categories where workspace_id = ws and name = 'Cuidados pessoais';
  select id into c_pets     from public.categories where workspace_id = ws and name = 'Pets';
  select id into c_viagem   from public.categories where workspace_id = ws and name = 'Viagem';
  select id into c_presentes from public.categories where workspace_id = ws and name = 'Presentes e doações';
  select id into c_freela   from public.categories where workspace_id = ws and name = 'Freelance';
  select id into c_salario  from public.categories where workspace_id = ws and name = 'Salário';

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
    (ws, 'income', 'Salário Ana', 650000, c_salario, 'transfer', acc_nu, ana, 5, start, false),
    (ws, 'income', 'Salário Caio', 480000, c_salario, 'transfer', acc_nu, caio, 7, start, false),
    (ws, 'expense', 'Aluguel', 280000, (select id from public.categories where workspace_id = ws and name = 'Moradia'), 'pix', acc_nu, null, 10, start, false),
    (ws, 'expense', 'Internet', 11990, (select id from public.categories where workspace_id = ws and name = 'Contas e serviços'), 'boleto', acc_nu, null, 15, start, false),
    (ws, 'expense', 'Academia', 12990, c_saude, 'debit', acc_nu, ana, 5, start, false);
  insert into public.recurrences (workspace_id, kind, description, amount_cents, category_id, payment_method, account_id, day_of_month, starts_on, auto_confirm)
  values (ws, 'expense', 'Luz', 18740, (select id from public.categories where workspace_id = ws and name = 'Contas e serviços'), 'pix', acc_nu, 20, start, false)
  returning id into r_luz;
  insert into public.recurrences (workspace_id, kind, description, amount_cents, category_id, payment_method, card_id, member_user_id, day_of_month, starts_on, auto_confirm)
  values
    (ws, 'expense', 'Netflix', 5590, (select id from public.categories where workspace_id = ws and name = 'Assinaturas'), 'credit', card_nu, null, 8, start, true),
    (ws, 'expense', 'Spotify', 2190, (select id from public.categories where workspace_id = ws and name = 'Assinaturas'), 'credit', card_inter, caio, 12, start, true);

  -- O que já passou está pago/recebido; o resto do mês fica "previsto".
  update public.transactions set is_settled = true where workspace_id = ws and recurrence_id is not null and occurred_on <= today;
  -- Conta de luz varia com a estação.
  update public.transactions set amount_cents = 14000 + (random() * 9000)::int
  where recurrence_id = r_luz and occurred_on <= today;

  -- Gastos do dia a dia, de 11 meses atrás até hoje.
  for d in select generate_series(start, today, interval '1 day')::date loop
    n := d - start;
    k := ((extract(year from d) - extract(year from start)) * 12 + extract(month from d) - extract(month from start))::int;
    -- Mês atual com delivery acima da média (o painel mostra o insight).
    boost := case when d >= m0 then 1.4 else 1 end;

    if n % 4 = 0 then
      insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on, category_id, payment_method, account_id, member_user_id)
      values (ws, 'expense', 12000 + (random() * 20000)::int, 'Mercado', d, c_mercado, 'debit', acc_nu, case when n % 8 = 0 then ana else caio end);
    end if;
    if n % 7 = 3 then
      insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on, category_id, payment_method, account_id, member_user_id)
      values (ws, 'expense', 1800 + (random() * 4000)::int, 'Padaria', d, c_mercado, 'cash', acc_wallet, ana);
    end if;
    if n % 5 = 1 then
      perform public.create_card_purchase(ws, card_nu, 1500 + (random() * 3000)::int, 1, 'Uber', d, c_transp, caio);
    end if;
    if n % 6 = 2 then
      perform public.create_card_purchase(ws, card_inter, ((3500 + random() * 6000) * boost)::int, 1, 'iFood', d, c_rest, ana);
    end if;
    if n % 15 = 9 then
      insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on, category_id, payment_method, account_id, member_user_id)
      values (ws, 'expense', 18000 + (random() * 8000)::int, 'Combustível', d, c_transp, 'debit', acc_nu, caio);
    end if;
    if n % 20 = 11 then
      insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on, category_id, payment_method, account_id, member_user_id)
      values (ws, 'expense', 3000 + (random() * 9000)::int, 'Farmácia', d, c_saude, 'pix', acc_nu, ana);
    end if;
    if n % 14 = 5 then
      insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on, category_id, payment_method, account_id, member_user_id)
      values (ws, 'expense', 8000 + (random() * 17000)::int, case when n % 28 = 5 then 'Cinema e jantar' else 'Bar com amigos' end,
              d, c_lazer, 'pix', acc_nu, case when n % 28 = 5 then ana else caio end);
    end if;

    -- Uma vez por mês
    if extract(day from d) = 2 then
      insert into public.transfers (workspace_id, from_account_id, to_account_id, amount_cents, occurred_on, description)
      values (ws, acc_nu, acc_wallet, 20000, d, 'Saque');
    end if;
    if extract(day from d) = 12 then
      insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on, category_id, payment_method, account_id, member_user_id)
      values (ws, 'expense', 6000 + (random() * 3000)::int, 'Cabeleireiro', d, c_cuidados, 'pix', acc_nu, ana),
             (ws, 'expense', 16000 + (random() * 4000)::int, 'Ração e petshop', d, c_pets, 'debit', acc_nu, caio);
    end if;

    -- Freelas eventuais (3, 7 e 1 mês atrás)
    if extract(day from d) = 18 and k in (4, 8, 10) then
      insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on, category_id, payment_method, account_id, member_user_id)
      values (ws, 'income', 120000 + (random() * 130000)::int,
              case k when 4 then 'Freela – app da clínica' when 8 then 'Freela – logo do café' else 'Freela – site da padaria' end,
              d, c_freela, 'pix', acc_nu, case when k = 8 then caio else ana end);
    end if;
    -- 13º salário em dezembro
    if extract(month from d) = 12 and extract(day from d) = 20 then
      insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on, category_id, payment_method, account_id, member_user_id)
      values (ws, 'income', 325000, '13º salário Ana', d, c_salario, 'transfer', acc_nu, ana);
    end if;
    -- Mês atípico (4 meses atrás): carro quebrou + presente de casamento
    if k = 7 and extract(day from d) = 14 then
      insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on, category_id, payment_method, account_id, member_user_id, notes)
      values (ws, 'expense', 385000, 'Conserto do carro', d, c_transp, 'pix', acc_nu, caio, 'Embreagem + revisão'),
             (ws, 'expense', 60000, 'Presente de casamento', d + 3, c_presentes, 'pix', acc_nu, ana, null);
    end if;
  end loop;

  -- Compras parceladas
  perform public.create_card_purchase(ws, card_inter, 179900, 6, 'Celular novo', private.add_months(start, 1) + 9, c_compras, caio);
  perform public.create_card_purchase(ws, card_nu, 240000, 3, 'Passagens – férias', private.add_months(start, 4) + 4, c_viagem, ana);
  -- Notebook em 10x começou há 3 meses: parcelas futuras atravessam a virada do ano.
  perform public.create_card_purchase(ws, card_nu, 499990, 10, 'Notebook', private.add_months(start, 8) + 13, c_compras, ana);

  -- ---------------------------------------------------------------------------
  -- Metas (Fase 4)
  --   Carro: R$ 60.000 em 24 meses, aportes irregulares nos últimos 7 meses → Poupança.
  --   Viagem: R$ 8.000 em 8 meses, aporte planejado de R$ 500 todo dia 5 (caixinha, sem conta).
  --   Reserva de emergência: sem prazo, R$ 8.500 já guardados, uma retirada no mês atípico.
  -- ---------------------------------------------------------------------------
  insert into public.goals (workspace_id, name, icon, color, target_cents, target_date, priority, reserve_account_id, created_at)
  values (ws, 'Carro', 'car', '#38bdf8', 6000000, private.add_months(m0, 25) - 1, 1, acc_save, private.add_months(m0, -7))
  returning id into g_carro;
  insert into public.goals (workspace_id, name, icon, color, target_cents, target_date, priority, created_at)
  values (ws, 'Viagem', 'plane', '#f472b6', 800000, private.add_months(m0, 9) - 1, 2, private.add_months(m0, -4))
  returning id into g_viagem;
  insert into public.goals (workspace_id, name, icon, color, target_cents, priority, initial_cents, reserve_account_id, annual_return_bps, created_at)
  values (ws, 'Reserva de emergência', 'shield', '#4ade80', 3000000, 1, 850000, acc_save, 1000, start)
  returning id into g_reserva;

  -- Carro: um aporte por mês (às vezes nenhum), alternando quem guardou.
  for k in 1 .. 7 loop
    if carro_aportes[k] > 0 then
      insert into public.goal_contributions (workspace_id, goal_id, amount_cents, contributed_on, account_id, member_user_id)
      values (ws, g_carro, carro_aportes[k], private.add_months(m0, k - 8) + 7, acc_nu, case when k % 2 = 0 then caio else ana end);
    end if;
  end loop;

  -- Viagem: aporte planejado mensal (recorrência com goal_id); os que já passaram foram confirmados.
  insert into public.recurrences (workspace_id, kind, description, amount_cents, payment_method, account_id, member_user_id,
                                  day_of_month, starts_on, auto_confirm, goal_id)
  values (ws, 'expense', 'Guardar para a viagem', 50000, 'transfer', acc_nu, ana, 5, private.add_months(m0, -3), false, g_viagem);
  update public.goal_contributions set is_planned = false where goal_id = g_viagem and contributed_on <= today;

  -- Reserva: aportes eventuais e uma retirada (com motivo) no mês do conserto do carro.
  insert into public.goal_contributions (workspace_id, goal_id, amount_cents, contributed_on, account_id, member_user_id, note)
  values
    (ws, g_reserva, 100000, private.add_months(start, 2) + 9, acc_nu, ana, null),
    (ws, g_reserva, 150000, private.add_months(start, 5) + 9, acc_nu, caio, null),
    (ws, g_reserva, -80000, private.add_months(start, 7) + 15, acc_nu, caio, 'Parte do conserto do carro');

  -- Paga as faturas já vencidas (total exato, no vencimento)
  insert into public.invoice_payments (workspace_id, invoice_id, account_id, amount_cents, paid_on)
  select ws, s.invoice_id, acc_nu, s.total_cents, s.due_date
  from public.card_invoice_summaries s
  where s.workspace_id = ws and s.due_date < today and s.total_cents > 0;
end $$;

select set_config('request.jwt.claims', '', false);
