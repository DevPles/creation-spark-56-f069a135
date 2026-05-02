-- Create opme-attachments storage bucket (public) and RLS policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('opme-attachments', 'opme-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read
DROP POLICY IF EXISTS "Public read opme-attachments" ON storage.objects;
CREATE POLICY "Public read opme-attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'opme-attachments');

-- Authenticated upload
DROP POLICY IF EXISTS "Authenticated upload opme-attachments" ON storage.objects;
CREATE POLICY "Authenticated upload opme-attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'opme-attachments');

-- Authenticated update
DROP POLICY IF EXISTS "Authenticated update opme-attachments" ON storage.objects;
CREATE POLICY "Authenticated update opme-attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'opme-attachments');

-- Authenticated delete
DROP POLICY IF EXISTS "Authenticated delete opme-attachments" ON storage.objects;
CREATE POLICY "Authenticated delete opme-attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'opme-attachments');