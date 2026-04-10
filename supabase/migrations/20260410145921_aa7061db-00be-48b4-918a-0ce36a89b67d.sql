CREATE TABLE public.sectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  facility_unit TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (name, facility_unit)
);

ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sectors" ON public.sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert sectors" ON public.sectors FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update sectors" ON public.sectors FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete sectors" ON public.sectors FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seed common sectors for Hospital Geral
INSERT INTO public.sectors (name, facility_unit) VALUES
  ('Maternidade', 'Hospital Geral'),
  ('UTI Adulto', 'Hospital Geral'),
  ('UTI Neonatal', 'Hospital Geral'),
  ('Clínica Médica', 'Hospital Geral'),
  ('Clínica Cirúrgica', 'Hospital Geral'),
  ('Pediatria', 'Hospital Geral'),
  ('Pronto Socorro', 'Hospital Geral'),
  ('Centro Cirúrgico', 'Hospital Geral'),
  ('Ambulatório', 'Hospital Geral'),
  ('Farmácia', 'Hospital Geral'),
  ('Laboratório', 'Hospital Geral'),
  ('Nutrição', 'Hospital Geral'),
  ('Fisioterapia', 'Hospital Geral'),
  ('Radiologia', 'Hospital Geral');