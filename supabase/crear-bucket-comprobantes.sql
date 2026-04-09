-- Crear bucket para comprobantes de pago
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes_pago',
  'comprobantes_pago',
  true,
  10485760,
  array[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Usuarios autenticados pueden subir comprobantes" on storage.objects;
drop policy if exists "Comprobantes son públicos" on storage.objects;
drop policy if exists "Usuarios pueden eliminar sus propios comprobantes" on storage.objects;

-- Política para que usuarios autenticados suban comprobantes
create policy "Usuarios autenticados pueden subir comprobantes"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'comprobantes_pago' AND 
  auth.role() = 'authenticated'
);

-- Política para que cualquiera pueda ver comprobantes
create policy "Comprobantes son públicos"
on storage.objects for select
to public
using (bucket_id = 'comprobantes_pago');

-- Política para que usuarios eliminen solo sus propios comprobantes
create policy "Usuarios pueden eliminar sus propios comprobantes"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'comprobantes_pago' AND
  auth.role() = 'authenticated'
);
