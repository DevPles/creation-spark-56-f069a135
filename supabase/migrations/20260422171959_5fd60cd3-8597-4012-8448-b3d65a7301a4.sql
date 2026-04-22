-- report_sections: restringir UPDATE
DROP POLICY IF EXISTS "Authenticated can update report_sections" ON public.report_sections;

CREATE POLICY "Authors gestors admins can update report_sections"
  ON public.report_sections
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = updated_by
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
  );

-- price_history: amarrar INSERT ao usuário autenticado
DROP POLICY IF EXISTS "insert price_history" ON public.price_history;

CREATE POLICY "insert price_history"
  ON public.price_history
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (created_by IS NULL OR created_by = auth.uid())
  );