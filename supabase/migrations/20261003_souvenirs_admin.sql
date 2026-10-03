-- Souvenirs gérés par les administrateurs : années, légendes et photos des six cubes.
-- Sans ligne en base, le site garde les valeurs de src/config.js (photos par défaut).

create table if not exists public.souvenirs (
  cube_index integer primary key check (cube_index between 0 and 5),
  year integer not null check (year between 1900 and 2100),
  caption text not null check (char_length(btrim(caption)) between 1 and 80),
  updated_at timestamptz not null default now()
);

-- storage_path null : face volontairement vide (illustration « Photo à venir »).
-- Ligne absente : photo par défaut de src/config.js.
create table if not exists public.souvenir_photos (
  cube_index integer not null check (cube_index between 0 and 5),
  face_index integer not null check (face_index between 0 and 5),
  storage_path text check (
    storage_path is null or storage_path ~ '^cube-[0-5]/face-[0-5]-[0-9]+\.jpg$'
  ),
  updated_at timestamptz not null default now(),
  primary key (cube_index, face_index)
);

alter table public.souvenirs enable row level security;
alter table public.souvenir_photos enable row level security;

revoke all on table public.souvenirs, public.souvenir_photos
  from public, anon, authenticated;
grant select on table public.souvenirs, public.souvenir_photos to anon, authenticated;

-- Les souvenirs sont affichés sur la page publique : lecture ouverte.
drop policy if exists "Everyone can read souvenirs" on public.souvenirs;
create policy "Everyone can read souvenirs"
  on public.souvenirs for select to anon, authenticated using (true);

drop policy if exists "Everyone can read souvenir photos" on public.souvenir_photos;
create policy "Everyone can read souvenir photos"
  on public.souvenir_photos for select to anon, authenticated using (true);

create or replace function public.is_staff_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff as s
    where s.user_id = (select auth.uid())
      and s.role = 'admin'
  );
$$;

create or replace function public.admin_save_souvenir(
  p_cube_index integer,
  p_year integer,
  p_caption text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff_admin() then
    raise exception 'Accès réservé aux administrateurs.' using errcode = '42501';
  end if;

  insert into public.souvenirs (cube_index, year, caption)
  values (p_cube_index, p_year, btrim(p_caption))
  on conflict (cube_index) do update
    set year = excluded.year,
        caption = excluded.caption,
        updated_at = now();

  return jsonb_build_object(
    'cube_index', p_cube_index,
    'year', p_year,
    'caption', btrim(p_caption)
  );
end;
$$;

-- Fixe la photo d'une face (chemin dans le bucket, ou null pour une face vide).
create or replace function public.admin_set_souvenir_photo(
  p_cube_index integer,
  p_face_index integer,
  p_storage_path text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff_admin() then
    raise exception 'Accès réservé aux administrateurs.' using errcode = '42501';
  end if;

  insert into public.souvenir_photos (cube_index, face_index, storage_path)
  values (p_cube_index, p_face_index, p_storage_path)
  on conflict (cube_index, face_index) do update
    set storage_path = excluded.storage_path,
        updated_at = now();
  return true;
end;
$$;

-- Revient à la photo par défaut du projet pour cette face.
create or replace function public.admin_reset_souvenir_photo(
  p_cube_index integer,
  p_face_index integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff_admin() then
    raise exception 'Accès réservé aux administrateurs.' using errcode = '42501';
  end if;

  delete from public.souvenir_photos as p
    where p.cube_index = p_cube_index and p.face_index = p_face_index;
  return true;
end;
$$;

revoke all on function public.is_staff_admin() from public, anon, authenticated;
revoke all on function public.admin_save_souvenir(integer, integer, text)
  from public, anon, authenticated;
revoke all on function public.admin_set_souvenir_photo(integer, integer, text)
  from public, anon, authenticated;
revoke all on function public.admin_reset_souvenir_photo(integer, integer)
  from public, anon, authenticated;

grant execute on function public.is_staff_admin() to authenticated;
grant execute on function public.admin_save_souvenir(integer, integer, text)
  to authenticated;
grant execute on function public.admin_set_souvenir_photo(integer, integer, text)
  to authenticated;
grant execute on function public.admin_reset_souvenir_photo(integer, integer)
  to authenticated;

-- Bucket public en lecture (images affichées sur le site), 5 Mo max, JPEG uniquement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('souvenirs', 'souvenirs', true, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins upload souvenir photos" on storage.objects;
create policy "Admins upload souvenir photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'souvenirs' and public.is_staff_admin());

drop policy if exists "Admins update souvenir photos" on storage.objects;
create policy "Admins update souvenir photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'souvenirs' and public.is_staff_admin())
  with check (bucket_id = 'souvenirs' and public.is_staff_admin());

drop policy if exists "Admins delete souvenir photos" on storage.objects;
create policy "Admins delete souvenir photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'souvenirs' and public.is_staff_admin());

-- Le client supprime l'ancien fichier après un remplacement : il doit pouvoir le lire.
drop policy if exists "Admins read souvenir photos" on storage.objects;
create policy "Admins read souvenir photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'souvenirs' and public.is_staff_admin());

comment on table public.souvenir_photos is
  'Photo d’une face de cube souvenir. storage_path null = face vide ; ligne absente = photo par défaut du projet.';
