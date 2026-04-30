ALTER TABLE public.opme_requests 
ADD COLUMN IF NOT EXISTS procedure_position_cadastro TEXT,
ADD COLUMN IF NOT EXISTS procedure_position_requisicao TEXT;