
-- =============================================
-- Table: rubrica_entries
-- =============================================
CREATE TABLE public.rubrica_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  rubrica_name text NOT NULL,
  value_executed numeric NOT NULL DEFAULT 0,
  period text NOT NULL,
  facility_unit text NOT NULL,
  notes text,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.rubrica_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view rubrica_entries"
ON public.rubrica_entries FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can insert own rubrica_entries"
ON public.rubrica_entries FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rubrica_entries"
ON public.rubrica_entries FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete rubrica_entries"
ON public.rubrica_entries FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_rubrica_entries_contract ON public.rubrica_entries(contract_id);
CREATE INDEX idx_rubrica_entries_period ON public.rubrica_entries(period);

-- =============================================
-- Table: sau_records
-- =============================================
CREATE TYPE public.sau_tipo AS ENUM ('elogio', 'reclamacao', 'sugestao', 'ouvidoria');
CREATE TYPE public.sau_status AS ENUM ('aberto', 'em_andamento', 'resolvido', 'cancelado');

CREATE TABLE public.sau_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_unit text NOT NULL,
  tipo public.sau_tipo NOT NULL,
  descricao text NOT NULL,
  status public.sau_status NOT NULL DEFAULT 'aberto',
  responsavel text,
  setor text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  notes text
);

ALTER TABLE public.sau_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sau_records"
ON public.sau_records FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can insert own sau_records"
ON public.sau_records FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins and gestors can update sau_records"
ON public.sau_records FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Admins can delete sau_records"
ON public.sau_records FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
