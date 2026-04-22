-- RLS policies for storage bucket 'purchase-attachments' (private)
-- Authenticated users can upload, view, and delete files inside their own folder (uid as first segment)
-- Admin/Gestor can view/delete all

CREATE POLICY "purchase-attachments authenticated insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'purchase-attachments'
);

CREATE POLICY "purchase-attachments authenticated select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'purchase-attachments'
);

CREATE POLICY "purchase-attachments authenticated update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'purchase-attachments'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role))
);

CREATE POLICY "purchase-attachments owner or admin delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'purchase-attachments'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role))
);