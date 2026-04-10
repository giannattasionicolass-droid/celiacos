begin;

create extension if not exists "pgcrypto";

create or replace function public.obtener_ip_visita_web()
returns text
language plpgsql
stable
as $$
declare
  headers jsonb;
  forwarded text;
  candidate text;
begin
  begin
    headers := coalesce(current_setting('request.headers', true), '{}')::jsonb;
  exception
    when others then
      headers := '{}'::jsonb;
  end;

  candidate := nullif(trim(coalesce(headers ->> 'cf-connecting-ip', headers ->> 'x-real-ip', '')), '');
  if candidate is not null then
    return candidate;
  end if;

  forwarded := nullif(trim(coalesce(headers ->> 'x-forwarded-for', '')), '');
  if forwarded is not null then
    return nullif(trim(split_part(forwarded, ',', 1)), '');
  end if;

  return null;
end;
$$;

create or replace function public.es_admin_email()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'giannattasio.nicolas@hotmail.com';
$$;

create table if not exists public.web_visitas (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  session_id text not null,
  path text not null default '/',
  referrer text not null default '',
  user_agent text not null default '',
  ip text default public.obtener_ip_visita_web(),
  created_at timestamptz not null default now()
);

alter table public.web_visitas add column if not exists visitor_id text;
alter table public.web_visitas add column if not exists session_id text;
alter table public.web_visitas add column if not exists path text not null default '/';
alter table public.web_visitas add column if not exists referrer text not null default '';
alter table public.web_visitas add column if not exists user_agent text not null default '';
alter table public.web_visitas add column if not exists ip text;
alter table public.web_visitas add column if not exists created_at timestamptz not null default now();

alter table public.web_visitas alter column ip set default public.obtener_ip_visita_web();

update public.web_visitas
set ip = public.obtener_ip_visita_web()
where ip is null;

create unique index if not exists web_visitas_session_id_key on public.web_visitas(session_id);
create index if not exists web_visitas_created_at_idx on public.web_visitas(created_at desc);
create index if not exists web_visitas_visitor_id_idx on public.web_visitas(visitor_id);

alter table public.web_visitas enable row level security;

drop policy if exists "web_visitas_insert_public" on public.web_visitas;
drop policy if exists "web_visitas_select_admin" on public.web_visitas;

create policy "web_visitas_insert_public"
on public.web_visitas
for insert
to anon, authenticated
with check (true);

create policy "web_visitas_select_admin"
on public.web_visitas
for select
to authenticated
using (public.es_admin_email());

grant usage on schema public to anon, authenticated;
grant insert on table public.web_visitas to anon, authenticated;
grant select on table public.web_visitas to authenticated;

commit;
