-- Crear bucket para comprobantes de pago
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comprobantes_pago',
  'comprobantes_pago',
  true,
  10485760, -- 10MB
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]
);

-- Política para que usuarios autenticados suban comprobantes
CREATE POLICY "Usuarios autenticados pueden subir comprobantes"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'comprobantes_pago' AND 
  auth.role() = 'authenticated'
);

-- Política para que cualquiera pueda ver comprobantes
CREATE POLICY "Comprobantes son públicos"
ON storage.objects FOR SELECT
WITH CHECK (bucket_id = 'comprobantes_pago');

-- Política para que usuarios eliminen solo sus propios comprobantes
CREATE POLICY "Usuarios pueden eliminar sus propios comprobantes"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'comprobantes_pago' AND
  auth.role() = 'authenticated'
);
