-- ============================================================
-- OPME ATTACHMENTS TABLE
-- ============================================================
CREATE TABLE public.opme_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opme_request_id UUID NOT NULL REFERENCES public.opme_requests(id) ON DELETE CASCADE,
  stage TEXT NOT NULL, -- 'solicitante' | 'auditor_pre' | 'almoxarifado' | 'cirurgia' | 'auditor_pos' | 'faturamento' | 'incidente'
  category TEXT NOT NULL, -- 'exame_preop' | 'foto_intraop' | 'exame_posop' | 'nf_fornecedor' | 'autorizacao_sus' | 'parecer_auditor' | 'outro'
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  file_size BIGINT,
  description TEXT,
  is_required BOOLEAN NOT NULL DEFAULT false,
  uploaded_by UUID NOT NULL,
  uploaded_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_opme_attachments_request ON public.opme_attachments(opme_request_id);
CREATE INDEX idx_opme_attachments_stage ON public.opme_attachments(stage);

ALTER TABLE public.opme_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view opme_attachments"
  ON public.opme_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert opme_attachments"
  ON public.opme_attachments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Owner or admin can delete opme_attachments"
  ON public.opme_attachments FOR DELETE TO authenticated
  USING (auth.uid() = uploaded_by OR has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- OPME HISTORY (AUDIT TRAIL)
-- ============================================================
CREATE TABLE public.opme_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opme_request_id UUID NOT NULL REFERENCES public.opme_requests(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'created' | 'field_changed' | 'status_changed' | 'attachment_added' | 'attachment_removed' | 'signed'
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  signature_name TEXT,
  signature_register TEXT,
  changed_by UUID NOT NULL,
  changed_by_name TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_opme_history_request ON public.opme_history(opme_request_id);
CREATE INDEX idx_opme_history_changed_at ON public.opme_history(changed_at DESC);

ALTER TABLE public.opme_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view opme_history"
  ON public.opme_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert opme_history"
  ON public.opme_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = changed_by);

-- ============================================================
-- AUTO AUDIT TRIGGER ON opme_requests
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_opme_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_name TEXT;
BEGIN
  SELECT name INTO user_name FROM public.profiles WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.opme_history (opme_request_id, action, new_value, changed_by, changed_by_name)
    VALUES (NEW.id, 'created', NEW.status::text, COALESCE(auth.uid(), NEW.created_by), user_name);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.opme_history (opme_request_id, action, field_changed, old_value, new_value, changed_by, changed_by_name)
      VALUES (NEW.id, 'status_changed', 'status', OLD.status::text, NEW.status::text, COALESCE(auth.uid(), NEW.created_by), user_name);
    END IF;
    IF NEW.patient_name IS DISTINCT FROM OLD.patient_name THEN
      INSERT INTO public.opme_history (opme_request_id, action, field_changed, old_value, new_value, changed_by, changed_by_name)
      VALUES (NEW.id, 'field_changed', 'patient_name', OLD.patient_name, NEW.patient_name, COALESCE(auth.uid(), NEW.created_by), user_name);
    END IF;
    IF NEW.procedure_name IS DISTINCT FROM OLD.procedure_name THEN
      INSERT INTO public.opme_history (opme_request_id, action, field_changed, old_value, new_value, changed_by, changed_by_name)
      VALUES (NEW.id, 'field_changed', 'procedure_name', OLD.procedure_name, NEW.procedure_name, COALESCE(auth.uid(), NEW.created_by), user_name);
    END IF;
    IF NEW.auditor_pre_opinion IS DISTINCT FROM OLD.auditor_pre_opinion THEN
      INSERT INTO public.opme_history (opme_request_id, action, field_changed, old_value, new_value, changed_by, changed_by_name)
      VALUES (NEW.id, 'field_changed', 'auditor_pre_opinion', OLD.auditor_pre_opinion, NEW.auditor_pre_opinion, COALESCE(auth.uid(), NEW.created_by), user_name);
    END IF;
    IF NEW.auditor_post_final_opinion IS DISTINCT FROM OLD.auditor_post_final_opinion THEN
      INSERT INTO public.opme_history (opme_request_id, action, field_changed, old_value, new_value, changed_by, changed_by_name)
      VALUES (NEW.id, 'field_changed', 'auditor_post_final_opinion', OLD.auditor_post_final_opinion, NEW.auditor_post_final_opinion, COALESCE(auth.uid(), NEW.created_by), user_name);
    END IF;
    IF NEW.facility_unit IS DISTINCT FROM OLD.facility_unit THEN
      INSERT INTO public.opme_history (opme_request_id, action, field_changed, old_value, new_value, changed_by, changed_by_name)
      VALUES (NEW.id, 'field_changed', 'facility_unit', OLD.facility_unit, NEW.facility_unit, COALESCE(auth.uid(), NEW.created_by), user_name);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_log_opme_changes
AFTER INSERT OR UPDATE ON public.opme_requests
FOR EACH ROW EXECUTE FUNCTION public.log_opme_changes();

-- ============================================================
-- STORAGE BUCKET FOR OPME ATTACHMENTS
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('opme-attachments', 'opme-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can view opme files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'opme-attachments');

CREATE POLICY "Authenticated can upload opme files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'opme-attachments');

CREATE POLICY "Owner or admin can delete opme files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'opme-attachments'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'::app_role))
  );