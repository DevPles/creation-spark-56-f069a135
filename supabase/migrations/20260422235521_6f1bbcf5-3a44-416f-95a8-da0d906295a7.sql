-- ============================================================
-- 1) SUPPLIERS — restringir UPDATE/DELETE a admin/gestor
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated can delete suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "delete suppliers" ON public.suppliers;

CREATE POLICY "Admins and gestors can update suppliers"
  ON public.suppliers FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins can delete suppliers"
  ON public.suppliers FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 2) GOALS — restringir INSERT/UPDATE a admin/gestor
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can insert goals" ON public.goals;
DROP POLICY IF EXISTS "Authenticated can update goals" ON public.goals;

CREATE POLICY "Admins and gestors can insert goals"
  ON public.goals FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins and gestors can update goals"
  ON public.goals FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- ============================================================
-- 3) REALTIME — adicionar RLS em realtime.messages
-- ============================================================
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can receive realtime" ON realtime.messages;
CREATE POLICY "Authenticated can receive realtime"
  ON realtime.messages FOR SELECT TO authenticated
  USING (true);

-- ============================================================
-- 4) STORAGE supplier-documents — UPDATE só do dono ou admin/gestor
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can update supplier-documents" ON storage.objects;

CREATE POLICY "Owner or admin can update supplier-documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'supplier-documents'
    AND (owner = auth.uid()
         OR has_role(auth.uid(), 'admin'::app_role)
         OR has_role(auth.uid(), 'gestor'::app_role))
  )
  WITH CHECK (bucket_id = 'supplier-documents');

-- ============================================================
-- 5) STORAGE opme-attachments — INSERT só na pasta do próprio user
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can upload opme files" ON storage.objects;

CREATE POLICY "Users can upload opme files to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'opme-attachments'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );