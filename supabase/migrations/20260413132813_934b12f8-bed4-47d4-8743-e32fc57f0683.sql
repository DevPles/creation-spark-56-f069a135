
CREATE TABLE public.contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  variable numeric NOT NULL DEFAULT 0.1,
  goals integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Vigente',
  period text NOT NULL DEFAULT '2024-2025',
  unit text NOT NULL,
  pdf_name text,
  pdf_url text,
  notification_email text,
  rubricas jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view contracts"
ON public.contracts FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins and gestors can insert contracts"
ON public.contracts FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
);

CREATE POLICY "Admins and gestors can update contracts"
ON public.contracts FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
);

CREATE POLICY "Admins and gestors can delete contracts"
ON public.contracts FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
);

CREATE TRIGGER update_contracts_updated_at
BEFORE UPDATE ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
