
-- Create report_section_entries for complementary data entries within report sections
CREATE TABLE public.report_section_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.report_sections(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL DEFAULT 'generic',
  entry_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  updated_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.report_section_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view report_section_entries"
  ON public.report_section_entries FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can insert own report_section_entries"
  ON public.report_section_entries FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator or admin can update report_section_entries"
  ON public.report_section_entries FOR UPDATE
  TO authenticated USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Creator or admin can delete report_section_entries"
  ON public.report_section_entries FOR DELETE
  TO authenticated USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_report_section_entries_updated_at
  BEFORE UPDATE ON public.report_section_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
