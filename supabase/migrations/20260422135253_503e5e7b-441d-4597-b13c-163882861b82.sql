ALTER TABLE public.product_catalog
  ADD COLUMN IF NOT EXISTS facility_unit TEXT,
  ADD COLUMN IF NOT EXISTS setor TEXT;