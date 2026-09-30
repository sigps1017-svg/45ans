create or replace function public.manage_staff_member(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_action text,
  p_new_role text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  target_role text;
  admin_count integer;
begin
  lock table public.staff in exclusive mode;

  select s.role
    into actor_role
    from public.staff as s
    where s.user_id = p_actor_user_id;

  if actor_role is distinct from 'admin' then
    raise exception 'Admin access denied.' using errcode = '42501';
  end if;

  select s.role
    into target_role
    from public.staff as s
    where s.user_id = p_target_user_id;

  if not found then
    return false;
  end if;

  if p_action = 'set_role' then
    if p_new_role is null or p_new_role not in ('admin', 'accueil') then
      raise exception 'Invalid staff role.' using errcode = '22023';
    end if;

    if p_target_user_id = p_actor_user_id
      and target_role = 'admin'
      and p_new_role <> 'admin' then
      raise exception 'You cannot remove your own admin role.'
        using errcode = 'P0001';
    end if;

    if target_role = 'admin' and p_new_role <> 'admin' then
      select count(*) into admin_count
        from public.staff as s
        where s.role = 'admin';
      if admin_count <= 1 then
        raise exception 'The last admin cannot be demoted.'
          using errcode = 'P0001';
      end if;
    end if;

    update public.staff as s
      set role = p_new_role
      where s.user_id = p_target_user_id;
    return true;
  end if;

  if p_action = 'remove' then
    if p_target_user_id = p_actor_user_id and target_role = 'admin' then
      raise exception 'You cannot remove your own admin access.'
        using errcode = 'P0001';
    end if;

    if target_role = 'admin' then
      select count(*) into admin_count
        from public.staff as s
        where s.role = 'admin';
      if admin_count <= 1 then
        raise exception 'The last admin cannot be removed.'
          using errcode = 'P0001';
      end if;
    end if;

    delete from public.staff as s where s.user_id = p_target_user_id;
    return true;
  end if;

  raise exception 'Invalid staff management action.' using errcode = '22023';
end;
$$;

revoke all on function public.manage_staff_member(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.manage_staff_member(uuid, uuid, text, text)
  to service_role;
