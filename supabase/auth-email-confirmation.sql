-- Endurece la sincronizacion entre auth.users y public.perfiles.
-- Objetivo:
-- 1. No crear perfil publico mientras el email no este confirmado.
-- 2. Crear el perfil automaticamente cuando el usuario confirma el email.
-- 3. Mantener email y metadata sincronizados si auth.users cambia.
--
-- Importante:
-- Esto NO reemplaza la configuracion de Supabase Auth.
-- En Authentication > Providers > Email tambien tenes que desactivar
-- la auto confirmacion (mailer_autoconfirm = false).

begin;

create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  apellido text,
  cuit text,
  email text,
  telefono text,
  nombre_fantasia text,
  direccion_envio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.perfiles add column if not exists nombre text;
alter table public.perfiles add column if not exists apellido text;
alter table public.perfiles add column if not exists cuit text;
alter table public.perfiles add column if not exists email text;
alter table public.perfiles add column if not exists telefono text;
alter table public.perfiles add column if not exists nombre_fantasia text;
alter table public.perfiles add column if not exists direccion_envio text;
alter table public.perfiles add column if not exists created_at timestamptz not null default now();
alter table public.perfiles add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.perfiles'::regclass
      and contype = 'p'
  ) then
    alter table public.perfiles add primary key (id);
  end if;
end $$;

create index if not exists perfiles_email_idx on public.perfiles(email);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_perfiles_updated_at on public.perfiles;

create trigger set_perfiles_updated_at
before update on public.perfiles
for each row
execute function public.set_updated_at();

alter table public.perfiles enable row level security;

drop policy if exists "perfiles_select_admin_or_own" on public.perfiles;
drop policy if exists "perfiles_insert_admin_or_own" on public.perfiles;
drop policy if exists "perfiles_update_admin_or_own" on public.perfiles;

create or replace function public.es_admin_email()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'giannattasio.nicolas@hotmail.com';
$$;

create policy "perfiles_select_admin_or_own"
on public.perfiles
for select
to authenticated
using (public.es_admin_email() or auth.uid() = id);

create policy "perfiles_insert_admin_or_own"
on public.perfiles
for insert
to authenticated
with check (public.es_admin_email() or auth.uid() = id);

create policy "perfiles_update_admin_or_own"
on public.perfiles
for update
to authenticated
using (public.es_admin_email() or auth.uid() = id)
with check (public.es_admin_email() or auth.uid() = id);

grant usage on schema public to anon, authenticated;
grant select, insert, update on table public.perfiles to authenticated;

create or replace function public.handle_auth_user_profile_sync()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  metadata jsonb;
begin
  metadata := coalesce(new.raw_user_meta_data, '{}'::jsonb);

  if new.email_confirmed_at is null then
    return new;
  end if;

  insert into public.perfiles (
    id,
    nombre,
    apellido,
    cuit,
    email,
    telefono,
    nombre_fantasia,
    direccion_envio
  )
  values (
    new.id,
    nullif(trim(metadata ->> 'nombre'), ''),
    nullif(trim(metadata ->> 'apellido'), ''),
    nullif(trim(metadata ->> 'cuit'), ''),
    nullif(trim(coalesce(new.email, metadata ->> 'email')), ''),
    nullif(trim(metadata ->> 'telefono'), ''),
    nullif(trim(metadata ->> 'nombre_fantasia'), ''),
    nullif(trim(coalesce(metadata ->> 'direccion_envio', metadata ->> 'direccion')), '')
  )
  on conflict (id) do update
  set
    nombre = excluded.nombre,
    apellido = excluded.apellido,
    cuit = excluded.cuit,
    email = excluded.email,
    telefono = excluded.telefono,
    nombre_fantasia = excluded.nombre_fantasia,
    direccion_envio = excluded.direccion_envio;

  return new;
end;
$$;

drop trigger if exists on_auth_user_profile_sync on auth.users;

create trigger on_auth_user_profile_sync
after insert or update of email_confirmed_at, email, raw_user_meta_data
on auth.users
for each row
execute function public.handle_auth_user_profile_sync();

-- Backfill opcional para usuarios ya confirmados que todavia no tengan perfil.
insert into public.perfiles (
  id,
  nombre,
  apellido,
  cuit,
  email,
  telefono,
  nombre_fantasia,
  direccion_envio
)
select
  u.id,
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'nombre', '')), ''),
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'apellido', '')), ''),
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'cuit', '')), ''),
  nullif(trim(coalesce(u.email, u.raw_user_meta_data ->> 'email')), ''),
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'telefono', '')), ''),
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'nombre_fantasia', '')), ''),
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'direccion_envio', u.raw_user_meta_data ->> 'direccion', '')), '')
from auth.users u
where u.email_confirmed_at is not null
on conflict (id) do update
set
  nombre = excluded.nombre,
  apellido = excluded.apellido,
  cuit = excluded.cuit,
  email = excluded.email,
  telefono = excluded.telefono,
  nombre_fantasia = excluded.nombre_fantasia,
  direccion_envio = excluded.direccion_envio;

commit;