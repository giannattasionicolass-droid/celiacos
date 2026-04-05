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