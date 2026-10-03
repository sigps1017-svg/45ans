-- Livre d'or : un message par invitation, écrit avec le lien personnel ?i=.
-- La table n'est accessible qu'au travers des fonctions ci-dessous.

create table if not exists public.livre_or (
  invite_id uuid primary key references public.invites(id) on delete cascade,
  signature text not null check (char_length(btrim(signature)) between 1 and 120),
  message text not null check (char_length(btrim(message)) between 1 and 1500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.livre_or enable row level security;
revoke all on table public.livre_or from public, anon, authenticated;

-- Message du foyer correspondant au token (null si aucun), avec le nom du foyer
-- pour préremplir la signature.
create or replace function public.get_guestbook_entry(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_row public.invites%rowtype;
  entry_row public.livre_or%rowtype;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{24}$' then
    return null;
  end if;

  select i.* into invite_row from public.invites as i where i.token = p_token;
  if not found then
    return null;
  end if;

  select l.* into entry_row from public.livre_or as l where l.invite_id = invite_row.id;

  return jsonb_build_object(
    'nom_foyer', invite_row.nom_foyer,
    'entry', case when entry_row.invite_id is null then null else jsonb_build_object(
      'signature', entry_row.signature,
      'message', entry_row.message,
      'updated_at', entry_row.updated_at
    ) end
  );
end;
$$;

create or replace function public.submit_guestbook_entry(
  p_token text,
  p_signature text,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_row public.invites%rowtype;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{24}$' then
    raise exception 'Lien d’invitation invalide.' using errcode = '22023';
  end if;

  select i.* into invite_row from public.invites as i where i.token = p_token;
  if not found then
    raise exception 'Invitation introuvable.' using errcode = 'P0002';
  end if;

  if char_length(btrim(coalesce(p_signature, ''))) not between 1 and 120 then
    raise exception 'La signature doit contenir entre 1 et 120 caractères.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_message, ''))) not between 1 and 1500 then
    raise exception 'Le message doit contenir entre 1 et 1500 caractères.'
      using errcode = '22023';
  end if;

  insert into public.livre_or (invite_id, signature, message)
  values (invite_row.id, btrim(p_signature), btrim(p_message))
  on conflict (invite_id) do update
    set signature = excluded.signature,
        message = excluded.message,
        updated_at = now();

  return public.get_guestbook_entry(p_token);
end;
$$;

-- Lecture pour toute l'équipe (rôles accueil et admin), dans l'ordre d'écriture.
create or replace function public.staff_list_guestbook()
returns table (
  invite_id uuid,
  nom_foyer text,
  signature text,
  message text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.staff as s where s.user_id = (select auth.uid())
  ) then
    raise exception 'Accès réservé à l’équipe.' using errcode = '42501';
  end if;

  return query
    select l.invite_id, i.nom_foyer, l.signature, l.message, l.created_at, l.updated_at
    from public.livre_or as l
    join public.invites as i on i.id = l.invite_id
    order by l.created_at;
end;
$$;

-- Suppression d'un message (modération), réservée aux administrateurs.
create or replace function public.admin_delete_guestbook_entry(p_invite_id uuid)
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

  delete from public.livre_or as l where l.invite_id = p_invite_id;
  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

revoke all on function public.get_guestbook_entry(text) from public, anon, authenticated;
revoke all on function public.submit_guestbook_entry(text, text, text)
  from public, anon, authenticated;
revoke all on function public.staff_list_guestbook() from public, anon, authenticated;
revoke all on function public.admin_delete_guestbook_entry(uuid)
  from public, anon, authenticated;

grant execute on function public.get_guestbook_entry(text) to anon, authenticated;
grant execute on function public.submit_guestbook_entry(text, text, text)
  to anon, authenticated;
grant execute on function public.staff_list_guestbook() to authenticated;
grant execute on function public.admin_delete_guestbook_entry(uuid) to authenticated;

comment on table public.livre_or is
  'Livre d’or : un message par invitation, modifiable par le foyer avec son lien personnel.';
