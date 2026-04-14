
-- Create report status enum
CREATE TYPE public.report_status AS ENUM ('rascunho', 'em_revisao', 'fechado', 'exportado');

-- Create reports table
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  facility_unit TEXT NOT NULL,
  reference_month INTEGER NOT NULL CHECK (reference_month BETWEEN 1 AND 12),
  reference_year INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status report_status NOT NULL DEFAULT 'rascunho',
  title TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL,
  updated_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (contract_id, facility_unit, reference_month, reference_year, version)
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view reports" ON public.reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins gestors can update reports" ON public.reports FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor') OR auth.uid() = created_by);
CREATE POLICY "Admins can delete reports" ON public.reports FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Add report_id to report_sections (nullable for backward compat)
ALTER TABLE public.report_sections ADD COLUMN IF NOT EXISTS report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE;
ALTER TABLE public.report_sections ADD COLUMN IF NOT EXISTS manual_content TEXT NOT NULL DEFAULT '';
ALTER TABLE public.report_sections ADD COLUMN IF NOT EXISTS auto_snapshot_json JSONB DEFAULT NULL;
ALTER TABLE public.report_sections ADD COLUMN IF NOT EXISTS completion_status TEXT NOT NULL DEFAULT 'pendente';

-- Add report_id to report_attachments (nullable for backward compat)
ALTER TABLE public.report_attachments ADD COLUMN IF NOT EXISTS report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE;

-- Create report_templates table
CREATE TABLE public.report_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  source_report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view report_templates" ON public.report_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own report_templates" ON public.report_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can delete report_templates" ON public.report_templates FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Enable realtime for reports
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
