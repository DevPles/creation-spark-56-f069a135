-- Adicionar colunas detalhadas de localização
ALTER TABLE public.opme_requests 
ADD COLUMN IF NOT EXISTS procedure_region_cadastro TEXT,
ADD COLUMN IF NOT EXISTS procedure_segment_cadastro TEXT,
ADD COLUMN IF NOT EXISTS procedure_region_requisicao TEXT,
ADD COLUMN IF NOT EXISTS procedure_segment_requisicao TEXT;
