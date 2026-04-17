-- Status enum
CREATE TYPE public.opme_status AS ENUM ('rascunho', 'aguardando_auditor_pre', 'aprovado_pre', 'em_execucao', 'aguardando_auditor_pos', 'concluido', 'cancelado', 'reprovado');

CREATE TABLE public.opme_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_unit TEXT NOT NULL,
  status public.opme_status NOT NULL DEFAULT 'rascunho',

  -- 1. Identificação do paciente
  patient_name TEXT NOT NULL DEFAULT '',
  patient_record TEXT,
  patient_birthdate DATE,
  patient_mother_name TEXT,
  patient_sus TEXT,

  -- 2. Dados do procedimento
  procedure_date DATE,
  procedure_type TEXT, -- eletivo / urgencia / emergencia
  procedure_name TEXT,
  procedure_sigtap_code TEXT,
  procedure_room TEXT,

  -- 3. Profissional solicitante
  requester_name TEXT,
  requester_register TEXT,

  -- 4. OPME solicitada (lista)
  opme_requested JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- 5. Instrumentais
  instruments_specific BOOLEAN DEFAULT false,
  instruments_loan BOOLEAN DEFAULT false,
  instruments_na BOOLEAN DEFAULT false,
  instruments_specify TEXT,

  -- 6. Justificativa
  clinical_indication TEXT,
  committee_opinion TEXT, -- aprovado / reprovado / em_analise

  -- 7. Imagem pré-operatória
  preop_image_types TEXT[] DEFAULT '{}',
  preop_image_other TEXT,
  preop_exam_date DATE,
  preop_exam_number TEXT,
  preop_finding_description TEXT,
  preop_image_attached BOOLEAN DEFAULT false,
  preop_image_count INTEGER DEFAULT 0,
  preop_validation_responsible TEXT,

  -- 8. Auditor pré-operatório
  auditor_pre_name TEXT,
  auditor_pre_crm TEXT,
  auditor_pre_analysis TEXT, -- adequada / inadequada / complementacao
  auditor_pre_sigtap_compat TEXT, -- sim / nao / parcial
  auditor_pre_opinion TEXT,
  auditor_pre_date DATE,

  -- 9. Controle administrativo
  request_date DATE,
  request_time TEXT,
  warehouse_received_by TEXT,
  warehouse_date DATE,
  warehouse_time TEXT,
  stock_available TEXT, -- sim / nao / parcial
  sent_to_cme BOOLEAN DEFAULT false,
  cme_processing_date DATE,
  cme_responsible TEXT,
  surgery_dispatch_date DATE,
  surgery_dispatch_responsible TEXT,

  -- 10. Registro de consumo
  opme_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  opme_returned JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- 11. Imagem pós-operatória
  postop_image_types TEXT[] DEFAULT '{}',
  postop_image_other TEXT,
  postop_exam_date DATE,
  postop_exam_number TEXT,
  postop_result_description TEXT,
  postop_image_attached BOOLEAN DEFAULT false,
  postop_image_count INTEGER DEFAULT 0,
  postop_validation_responsible TEXT,

  -- 12. Auditor pós-operatório
  auditor_post_name TEXT,
  auditor_post_crm TEXT,
  auditor_post_procedure_compat TEXT,
  auditor_post_sigtap_compat TEXT,
  auditor_post_image_conformity TEXT,
  auditor_post_final_opinion TEXT,
  auditor_post_date DATE,

  -- 13. Justificativa perda/dano
  incident_date DATE,
  incident_description TEXT,
  incident_responsible TEXT,

  -- 14. Faturamento
  billing_aih_number TEXT,
  billing_procedure_name TEXT,
  billing_sigtap_code TEXT,
  billing_prior_authorization TEXT,
  billing_aih_generated BOOLEAN,
  billing_opme_compatibility TEXT,
  billing_divergence BOOLEAN DEFAULT false,
  billing_divergence_description TEXT,
  billing_docs JSONB NOT NULL DEFAULT '{}'::jsonb,

  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.opme_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view opme_requests"
  ON public.opme_requests FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert opme_requests"
  ON public.opme_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator admin or gestor can update opme_requests"
  ON public.opme_requests FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admin can delete opme_requests"
  ON public.opme_requests FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_opme_requests_updated_at
  BEFORE UPDATE ON public.opme_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_opme_requests_facility ON public.opme_requests(facility_unit);
CREATE INDEX idx_opme_requests_status ON public.opme_requests(status);
CREATE INDEX idx_opme_requests_created_at ON public.opme_requests(created_at DESC);