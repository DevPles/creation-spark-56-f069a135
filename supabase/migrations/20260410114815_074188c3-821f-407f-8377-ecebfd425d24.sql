
-- Create beds table
CREATE TABLE public.beds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_unit TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'internacao',
  specialty TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated can view beds"
  ON public.beds FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert beds"
  ON public.beds FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update beds"
  ON public.beds FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete beds"
  ON public.beds FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_beds_updated_at
  BEFORE UPDATE ON public.beds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert Hospital Geral - Leitos de Internação (144 total)
INSERT INTO public.beds (facility_unit, category, specialty, quantity) VALUES
  ('Hospital Geral', 'internacao', 'Clínica Cirúrgica', 20),
  ('Hospital Geral', 'internacao', 'Clínica Médica', 42),
  ('Hospital Geral', 'internacao', 'Obstetrícia', 24),
  ('Hospital Geral', 'internacao', 'Psiquiatria', 10),
  ('Hospital Geral', 'internacao', 'Clínica Pediátrica', 13),
  ('Hospital Geral', 'internacao', 'UTI Adulto', 20),
  ('Hospital Geral', 'internacao', 'UTI Neonatal', 5),
  ('Hospital Geral', 'internacao', 'Unidade de Cuidados Intermediários Neonatal', 10);

-- Insert Hospital Geral - Leitos Complementares (63 total)
INSERT INTO public.beds (facility_unit, category, specialty, quantity) VALUES
  ('Hospital Geral', 'complementar', 'Sala de emergência adulta', 10),
  ('Hospital Geral', 'complementar', 'Sala de emergência trauma', 2),
  ('Hospital Geral', 'complementar', 'Unidade de avaliação', 4),
  ('Hospital Geral', 'complementar', 'Sala laranja', 10),
  ('Hospital Geral', 'complementar', 'Sala de emergência pediátrica', 3),
  ('Hospital Geral', 'complementar', 'Observação adulta', 10),
  ('Hospital Geral', 'complementar', 'Observação infantil', 3),
  ('Hospital Geral', 'complementar', 'Recuperação anestésica', 4),
  ('Hospital Geral', 'complementar', 'Centro cirúrgico (salas)', 4),
  ('Hospital Geral', 'complementar', 'Centro obstétrico (salas)', 2),
  ('Hospital Geral', 'complementar', 'Recuperação anestésica obstétrica', 2),
  ('Hospital Geral', 'complementar', 'Pré-parto', 9);
