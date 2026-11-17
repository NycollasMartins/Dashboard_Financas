-- =============================================================================
-- 0004 · Diretório de membros
-- Os e-mails ficam em auth.users (inacessível ao cliente). Esta RPC devolve
-- nome + e-mail SOMENTE dos membros de um espaço do qual quem chama participa.
-- =============================================================================
create or replace function public.get_workspace_members(p_workspace_id uuid)
returns table (
  user_id uuid,
  full_name text,
  email text,
  role public.member_role,
  joined_at timestamptz,
  is_owner boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  if not private.is_member(p_workspace_id) then
    raise exception 'Você não participa deste espaço' using errcode = '42501';
  end if;

  return query
  select m.user_id,
         coalesce(p.full_name, ''),
         u.email::text,
         m.role,
         m.joined_at,
         m.user_id = w.owner_id
  from public.workspace_members m
  join public.workspaces w on w.id = m.workspace_id
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.workspace_id = p_workspace_id
  order by (m.user_id = w.owner_id) desc, m.role, m.joined_at;
end;
$$;

revoke all on function public.get_workspace_members(uuid) from public, anon;
grant execute on function public.get_workspace_members(uuid) to authenticated;
