
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.cid10 (
  codigo TEXT PRIMARY KEY,
  descricao TEXT NOT NULL,
  categoria TEXT,
  capitulo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cid10_codigo_lower ON public.cid10 (lower(codigo));
CREATE INDEX IF NOT EXISTS idx_cid10_descricao_trgm ON public.cid10 USING GIN (descricao gin_trgm_ops);

ALTER TABLE public.cid10 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CID10 visivel autenticados"
ON public.cid10 FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "CID10 admin insert"
ON public.cid10 FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "CID10 admin update"
ON public.cid10 FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "CID10 admin delete"
ON public.cid10 FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
