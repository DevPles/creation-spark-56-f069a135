
CREATE TABLE public.bed_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_unit text NOT NULL,
  category text NOT NULL DEFAULT 'internacao',
  specialty text NOT NULL,
  movement_date date NOT NULL,
  occupied integer NOT NULL DEFAULT 0,
  admissions integer NOT NULL DEFAULT 0,
  discharges integer NOT NULL DEFAULT 0,
  deaths integer NOT NULL DEFAULT 0,
  transfers integer NOT NULL DEFAULT 0,
  user_id uuid NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (facility_unit, category, specialty, movement_date)
);

ALTER TABLE public.bed_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view bed_movements"
  ON public.bed_movements FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own bed_movements"
  ON public.bed_movements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bed_movements"
  ON public.bed_movements FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete bed_movements"
  ON public.bed_movements FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_bed_movements_unit_date ON public.bed_movements (facility_unit, movement_date);
