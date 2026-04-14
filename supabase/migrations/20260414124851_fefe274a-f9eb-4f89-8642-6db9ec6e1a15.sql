
-- Table to store report section content per contract and period
CREATE TABLE public.report_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
  facility_unit TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT '',
  section_key TEXT NOT NULL,
  section_title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contract_id, period, section_key)
);

-- Table to store attachments (images, files) for each report section
CREATE TABLE public.report_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID REFERENCES public.report_sections(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'image',
  sort_order INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.report_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for report_sections
CREATE POLICY "Authenticated can view report_sections" ON public.report_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert report_sections" ON public.report_sections FOR INSERT TO authenticated WITH CHECK (auth.uid() = updated_by);
CREATE POLICY "Authenticated can update report_sections" ON public.report_sections FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete report_sections" ON public.report_sections FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for report_attachments
CREATE POLICY "Authenticated can view report_attachments" ON public.report_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert report_attachments" ON public.report_attachments FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Admins can delete report_attachments" ON public.report_attachments FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for report files
INSERT INTO storage.buckets (id, name, public) VALUES ('report-files', 'report-files', true);

-- Storage policies
CREATE POLICY "Authenticated can upload report files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'report-files');
CREATE POLICY "Anyone can view report files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'report-files');
CREATE POLICY "Admins can delete report files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'report-files' AND has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_report_sections_updated_at BEFORE UPDATE ON public.report_sections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
