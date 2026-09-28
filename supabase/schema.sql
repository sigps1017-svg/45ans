create extension if not exists pgcrypto with schema extensions;

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(extensions.gen_random_bytes(12), 'hex'),
  nom_foyer text not null check (char_length(btrim(nom_foyer)) between 1 and 120),
  places_max integer not null check (places_max between 1 and 30),
  table_num integer check (table_num is null or table_num > 0),
  created_at timestamptz not null default now(),
  constraint invites_token_format check (token ~ '^[a-f0-9]{24}$')
);

create table if not exists public.reponses (
  invite_id uuid primary key references public.invites(id) on delete cascade,
  presence text not null check (presence in ('oui', 'non')),
  invites_detail jsonb not null default '[]'::jsonb
    check (jsonb_typeof(invites_detail) = 'array'),
  allergies text,
  updated_at timestamptz not null default now(),
  checked_in_at timestamptz
);

create index if not exists reponses_checked_in_at_idx
  on public.reponses (checked_in_at)
  where checked_in_at is not null;

create table if not exists public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.invites enable row level security;
alter table public.reponses enable row level security;
alter table public.staff enable row level security;

revoke all on table public.invites, public.reponses, public.staff
  from public, anon, authenticated;

grant select on table public.invites, public.reponses, public.staff
  to authenticated;
grant update (checked_in_at) on table public.reponses to authenticated;

drop policy if exists "Staff can read invites" on public.invites;
create policy "Staff can read invites"
  on public.invites
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.staff as s
      where s.user_id = (select auth.uid())
    )
  );

drop policy if exists "Staff can read responses" on public.reponses;
create policy "Staff can read responses"
  on public.reponses
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.staff as s
      where s.user_id = (select auth.uid())
    )
  );

drop policy if exists "Staff can mark arrivals" on public.reponses;
create policy "Staff can mark arrivals"
  on public.reponses
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.staff as s
      where s.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.staff as s
      where s.user_id = (select auth.uid())
    )
  );

drop policy if exists "Staff can read their own membership" on public.staff;
create policy "Staff can read their own membership"
  on public.staff
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.get_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_row public.invites%rowtype;
  response_row jsonb;
begin
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
      'updated_at', r.updated_at
    )
    into response_row
    from public.reponses as r
    where r.invite_id = invite_row.id;

  return jsonb_build_object(
    'id', invite_row.id,
    'token', invite_row.token,
    'nom_foyer', invite_row.nom_foyer,
    'places_max', invite_row.places_max,
    'reponse', response_row
  );
end;
$$;

create or replace function public.submit_rsvp(
  p_token text,
  p_presence text,
  p_invites_detail jsonb,
  p_allergies text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_row public.invites%rowtype;
  guests jsonb;
  guest jsonb;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{24}$' then
    raise exception 'Lien d’invitation invalide.' using errcode = '22023';
  end if;

  select i.*
    into invite_row
    from public.invites as i
    where i.token = p_token
    for update;

  if not found then
    raise exception 'Invitation introuvable.' using errcode = 'P0002';
  end if;

  if p_presence is null or p_presence not in ('oui', 'non') then
    raise exception 'La présence doit être « oui » ou « non ».'
      using errcode = '22023';
  end if;

  if p_presence = 'oui' then
    if p_invites_detail is null
      or jsonb_typeof(p_invites_detail) <> 'array' then
      raise exception 'La liste des personnes est invalide.'
        using errcode = '22023';
    end if;

    if jsonb_array_length(p_invites_detail) < 1
      or jsonb_array_length(p_invites_detail) > invite_row.places_max then
      raise exception 'Le nombre de personnes dépasse les places de cette invitation.'
        using errcode = '22023';
    end if;

    guests := '[]'::jsonb;
    for guest in select value from jsonb_array_elements(p_invites_detail)
    loop
      if jsonb_typeof(guest) <> 'object'
        or jsonb_typeof(guest -> 'name') <> 'string'
        or jsonb_typeof(guest -> 'drink') <> 'string'
        or nullif(btrim(guest ->> 'name'), '') is null
        or char_length(guest ->> 'name') > 100
        or nullif(btrim(guest ->> 'drink'), '') is null
        or char_length(guest ->> 'drink') > 80 then
        raise exception 'Chaque personne doit avoir un prénom et une boisson valides.'
          using errcode = '22023';
      end if;
      guests := guests || jsonb_build_array(
        jsonb_build_object(
          'name', btrim(guest ->> 'name'),
          'drink', btrim(guest ->> 'drink')
        )
      );
    end loop;
  else
    guests := '[]'::jsonb;
  end if;

  if char_length(coalesce(p_allergies, '')) > 1000 then
    raise exception 'Le champ allergies est trop long.' using errcode = '22023';
  end if;

  insert into public.reponses (
    invite_id,
    presence,
    invites_detail,
    allergies,
    updated_at
  )
  values (
    invite_row.id,
    p_presence,
    guests,
    nullif(btrim(p_allergies), ''),
    now()
  )
  on conflict (invite_id) do update
    set presence = excluded.presence,
        invites_detail = excluded.invites_detail,
        allergies = excluded.allergies,
        updated_at = now();

  return public.get_invite(p_token);
end;
$$;

revoke all on function public.get_invite(text) from public, anon, authenticated;
revoke all on function public.submit_rsvp(text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.get_invite(text) to anon, authenticated;
grant execute on function public.submit_rsvp(text, text, jsonb, text)
  to anon, authenticated;

comment on table public.staff is
  'Ajoutez ici les UUID des utilisateurs autorisés, après création de leur compte Supabase Auth.';
