ALTER TABLE public.product_catalog
  ADD COLUMN IF NOT EXISTS descricao_resumida text,
  ADD COLUMN IF NOT EXISTS categoria_opme text,
  ADD COLUMN IF NOT EXISTS sigtap_code text,
  ADD COLUMN IF NOT EXISTS sigtap_procedures jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS requires_prior_auth boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_lote boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_validade boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_etiqueta boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS uso_unico boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reprocessavel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fabricante text,
  ADD COLUMN IF NOT EXISTS fornecedor_padrao text,
  ADD COLUMN IF NOT EXISTS consignado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS multiplicador_embalagem numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS preco_referencia numeric;

CREATE INDEX IF NOT EXISTS idx_product_catalog_sigtap_code ON public.product_catalog (sigtap_code);
CREATE INDEX IF NOT EXISTS idx_product_catalog_categoria_opme ON public.product_catalog (categoria_opme);