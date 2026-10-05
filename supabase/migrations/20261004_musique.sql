-- Musique de fond du site : morceaux chargés par les admins, un seul actif à la fois.
-- Prérequis : 20261003_souvenirs_admin.sql (fonction public.is_staff_admin).

create table if not exists public.musiques (
  id uuid primary key default gen_random_uuid(),
  titre text not null check (char_length(btrim(titre)) between 1 and 120),
  storage_path text not null unique check (
    storage_path ~ '^piste-[0-9]+\.(mp3|m4a|aac)$'
  ),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Au plus un morceau actif.
create unique index if not exists musiques_une_seule_active
  on public.musiques (active)
  where active;

alter table public.musiques enable row level security;
revoke all on table public.musiques from public, anon, authenticated;
grant select on table public.musiques to anon, authenticated;

-- Le morceau joué est public (il est entendu sur le site) : lecture ouverte.
drop policy if exists "Everyone can read musiques" on public.musiques;
create policy "Everyone can read musiques"
  on public.musiques for select to anon, authenticated using (true);

create or replace function public.admin_add_music(p_titre text, p_storage_path text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not public.is_staff_admin() then
    raise exception 'Accès réservé aux administrateurs.' using errcode = '42501';
  end if;

  insert into public.musiques (titre, storage_path)
  values (btrim(p_titre), p_storage_path)
  returning id into new_id;
  return new_id;
end;
$$;

-- Choisit le morceau joué sur le site (null : aucune musique).
create or replace function public.admin_select_music(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff_admin() then
    raise exception 'Accès réservé aux administrateurs.' using errcode = '42501';
  end if;

  update public.musiques as m set active = false where m.active;
  if p_id is not null then
    update public.musiques as m set active = true where m.id = p_id;
    if not found then
      raise exception 'Morceau introuvable.' using errcode = 'P0002';
    end if;
  end if;
  return true;
end;
$$;

create or replace function public.admin_rename_music(p_id uuid, p_titre text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff_admin() then
    raise exception 'Accès réservé aux administrateurs.' using errcode = '42501';
  end if;

  update public.musiques as m set titre = btrim(p_titre) where m.id = p_id;
  return found;
end;
$$;

-- Supprime la ligne et renvoie le chemin du fichier, que le client retire du bucket.
create or replace function public.admin_delete_music(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed_path text;
begin
  if not public.is_staff_admin() then
    raise exception 'Accès réservé aux administrateurs.' using errcode = '42501';
  end if;

  delete from public.musiques as m where m.id = p_id
    returning m.storage_path into removed_path;
  return removed_path;
end;
$$;

revoke all on function public.admin_add_music(text, text) from public, anon, authenticated;
revoke all on function public.admin_select_music(uuid) from public, anon, authenticated;
revoke all on function public.admin_rename_music(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_delete_music(uuid) from public, anon, authenticated;

grant execute on function public.admin_add_music(text, text) to authenticated;
grant execute on function public.admin_select_music(uuid) to authenticated;
grant execute on function public.admin_rename_music(uuid, text) to authenticated;
grant execute on function public.admin_delete_music(uuid) to authenticated;

-- Bucket public en lecture, 20 Mo max, formats lus par tous les navigateurs (iPhone compris).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'musique', 'musique', true, 20971520,
  array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins upload music" on storage.objects;
create policy "Admins upload music"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'musique' and public.is_staff_admin());

drop policy if exists "Admins delete music" on storage.objects;
create policy "Admins delete music"
  on storage.objects for delete to authenticated
  using (bucket_id = 'musique' and public.is_staff_admin());

drop policy if exists "Admins read music" on storage.objects;
create policy "Admins read music"
  on storage.objects for select to authenticated
  using (bucket_id = 'musique' and public.is_staff_admin());

comment on table public.musiques is
  'Musique de fond : morceaux chargés par les admins ; active = morceau joué sur le site.';
