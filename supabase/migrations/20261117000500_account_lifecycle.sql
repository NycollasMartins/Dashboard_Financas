-- =============================================================================
-- 0005 · Ciclo de vida da conta: transferência de posse e exclusão de conta
-- -----------------------------------------------------------------------------
-- Regras (docs/requisitos.md RN-40…RN-44):
--   * Só o dono transfere a posse de uma família, e só para um MEMBRO dela.
--     O novo dono vira admin; o antigo continua admin.
--   * Exclusão de conta é BLOQUEADA se o usuário for dono de uma família que
--     tenha outros membros (precisa transferir a posse ou excluir a família).
--   * Ao excluir: espaço individual e famílias em que ele está sozinho são
--     apagados; nas demais famílias, os registros dele ficam ANONIMIZADOS
--     (created_by / member_user_id / owner_user_id → NULL, via FKs).
-- =============================================================================

-- owner_id continua imutável, exceto dentro de transfer_workspace_ownership,
-- que liga uma flag local à transação.
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
      if v_col = 'created_by' and (v_new -> v_col) = 'null'::jsonb then
        continue; -- usuário excluído (ON DELETE SET NULL)
      end if;
      if v_col = 'owner_id' and current_setting('app.ownership_transfer', true) = 'on' then
        continue;
      end if;
      raise exception 'A coluna % não pode ser alterada', v_col using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Transferir posse de uma família
-- -----------------------------------------------------------------------------
create or replace function public.transfer_workspace_ownership(p_workspace_id uuid, p_new_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ws public.workspaces%rowtype;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  select * into v_ws from public.workspaces where id = p_workspace_id for update;
  if not found or v_ws.owner_id <> v_uid then
    raise exception 'Apenas o dono pode transferir a posse' using errcode = '42501';
  end if;
  if v_ws.kind <> 'household' then
    raise exception 'O espaço individual não pode ser transferido' using errcode = '22023';
  end if;
  if p_new_owner = v_uid then
    raise exception 'Você já é o dono' using errcode = '22023';
  end if;
  if not private.user_is_member(p_workspace_id, p_new_owner) then
    raise exception 'O novo dono precisa ser membro da família' using errcode = '22023';
  end if;

  update public.workspace_members set role = 'admin'
   where workspace_id = p_workspace_id and user_id = p_new_owner;

  perform set_config('app.ownership_transfer', 'on', true);
  update public.workspaces set owner_id = p_new_owner where id = p_workspace_id;
  perform set_config('app.ownership_transfer', 'off', true);
end;
$$;

revoke all on function public.transfer_workspace_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_workspace_ownership(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- O que impede a exclusão da conta (para a tela explicar ao usuário)
-- -----------------------------------------------------------------------------
create or replace function public.get_account_deletion_blockers()
returns table (workspace_id uuid, workspace_name text, other_members int)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, w.name, (count(m.user_id) - 1)::int
  from public.workspaces w
  join public.workspace_members m on m.workspace_id = w.id
  where w.owner_id = (select auth.uid()) and w.kind = 'household'
  group by w.id, w.name
  having count(m.user_id) > 1
  order by w.name;
$$;

revoke all on function public.get_account_deletion_blockers() from public, anon;
grant execute on function public.get_account_deletion_blockers() to authenticated;

-- -----------------------------------------------------------------------------
-- Excluir a própria conta
-- -----------------------------------------------------------------------------
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

  -- Anonimiza o que fica em famílias de outras pessoas (as FKs já fariam SET NULL,
  -- mas deixamos explícito e garantimos a ordem antes de apagar o usuário).
  update public.transactions set member_user_id = null where member_user_id = v_uid;
  update public.goal_contributions set member_user_id = null where member_user_id = v_uid;
  update public.recurrences set member_user_id = null where member_user_id = v_uid;

  -- Primeiro os espaços que ele possui (individual + famílias em que está sozinho).
  -- Fazer antes evita que a cascata remova a linha de membro do dono antes do
  -- espaço (o trigger de proteção do dono recusaria).
  delete from public.workspaces where owner_id = v_uid;

  -- Depois o usuário: cascata remove profile, participações em outras famílias,
  -- vínculos de canal e sessões do Auth; created_by vira NULL (anonimização).
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
