alter table public.staff
  add column if not exists role text not null default 'accueil';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.staff'::regclass
      and conname = 'staff_role_check'
  ) then
    alter table public.staff
      add constraint staff_role_check check (role in ('admin', 'accueil'));
  end if;
end;
$$;

revoke select on table public.invites from public, anon, authenticated;
grant select (id, nom_foyer, places_max, table_num, created_at)
  on table public.invites to authenticated;

create or replace function public.get_invite_for_staff(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_row public.invites%rowtype;
  response_row jsonb;
begin
  if not exists (
    select 1
    from public.staff as s
    where s.user_id = (select auth.uid())
  ) then
    raise exception 'Accès réservé à l’équipe.' using errcode = '42501';
  end if;

  if p_token is null or p_token !~ '^[a-f0-9]{24}$' then
    return null;
  end if;

  select i.*
    into invite_row
    from public.invites as i
    where i.token = p_token;

  if not found then
    return null;
  end if;

  select jsonb_build_object(
      'presence', r.presence,
      'invites_detail', r.invites_detail,
      'allergies', r.allergies,
      'updated_at', r.updated_at,
      'checked_in_at', r.checked_in_at
    )
    into response_row
    from public.reponses as r
    where r.invite_id = invite_row.id;

  return jsonb_build_object(
    'id', invite_row.id,
    'nom_foyer', invite_row.nom_foyer,
    'places_max', invite_row.places_max,
    'table_num', invite_row.table_num,
    'response', response_row
  );
end;
$$;

create or replace function public.admin_list_invites()
returns table (
  id uuid,
  token text,
  nom_foyer text,
  places_max integer,
  table_num integer,
  created_at timestamptz,
  presence text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.staff as s
    where s.user_id = (select auth.uid())
      and s.role = 'admin'
  ) then
    raise exception 'Accès réservé aux administrateurs.' using errcode = '42501';
  end if;

  return query
    select i.id, i.token, i.nom_foyer, i.places_max, i.table_num, i.created_at,
      r.presence
    from public.invites as i
    left join public.reponses as r on r.invite_id = i.id
    order by i.nom_foyer;
end;
$$;

create or replace function public.admin_create_invite(
  p_nom_foyer text,
  p_places_max integer,
  p_table_num integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_row public.invites%rowtype;
begin
  if not exists (
    select 1
    from public.staff as s
    where s.user_id = (select auth.uid())
      and s.role = 'admin'
  ) then
    raise exception 'Accès réservé aux administrateurs.' using errcode = '42501';
  end if;

  insert into public.invites (nom_foyer, places_max, table_num)
  values (p_nom_foyer, p_places_max, p_table_num)
  returning * into invite_row;

  return jsonb_build_object(
    'id', invite_row.id,
    'token', invite_row.token,
    'nom_foyer', invite_row.nom_foyer,
    'places_max', invite_row.places_max,
    'table_num', invite_row.table_num,
    'created_at', invite_row.created_at,
    'presence', null
  );
end;
$$;

create or replace function public.admin_update_invite(
  p_invite_id uuid,
  p_nom_foyer text,
  p_places_max integer,
  p_table_num integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_row public.invites%rowtype;
  presence_value text;
begin
  if not exists (
    select 1
    from public.staff as s
    where s.user_id = (select auth.uid())
      and s.role = 'admin'
  ) then
    raise exception 'Accès réservé aux administrateurs.' using errcode = '42501';
  end if;

  update public.invites as i
    set nom_foyer = p_nom_foyer,
        places_max = p_places_max,
        table_num = p_table_num
    where i.id = p_invite_id
    returning i.* into invite_row;

  if not found then
    raise exception 'Invitation introuvable.' using errcode = 'P0002';
  end if;

  select r.presence into presence_value
    from public.reponses as r
    where r.invite_id = invite_row.id;

  return jsonb_build_object(
    'id', invite_row.id,
    'token', invite_row.token,
    'nom_foyer', invite_row.nom_foyer,
    'places_max', invite_row.places_max,
    'table_num', invite_row.table_num,
    'created_at', invite_row.created_at,
    'presence', presence_value
  );
end;
$$;

create or replace function public.admin_delete_invite(p_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if not exists (
    select 1
    from public.staff as s
    where s.user_id = (select auth.uid())
      and s.role = 'admin'
  ) then
    raise exception 'Accès réservé aux administrateurs.' using errcode = '42501';
  end if;

  delete from public.invites as i where i.id = p_invite_id;
  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

revoke all on function public.get_invite_for_staff(text)
  from public, anon, authenticated;
revoke all on function public.admin_list_invites()
  from public, anon, authenticated;
revoke all on function public.admin_create_invite(text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.admin_update_invite(uuid, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.admin_delete_invite(uuid)
  from public, anon, authenticated;

grant execute on function public.get_invite_for_staff(text) to authenticated;
grant execute on function public.admin_list_invites() to authenticated;
grant execute on function public.admin_create_invite(text, integer, integer)
  to authenticated;
grant execute on function public.admin_update_invite(uuid, text, integer, integer)
  to authenticated;
grant execute on function public.admin_delete_invite(uuid) to authenticated;

comment on column public.staff.role is
  'Rôle de back-office : admin (gestion des invitations) ou accueil (pointage uniquement).';
comment on function public.admin_delete_invite(uuid) is
  'La suppression d’une invitation supprime aussi sa réponse liée.';

-- Après avoir créé un compte Auth et l’avoir ajouté à public.staff :
-- update public.staff set role = 'admin' where user_id = '<UUID du compte Auth>';
