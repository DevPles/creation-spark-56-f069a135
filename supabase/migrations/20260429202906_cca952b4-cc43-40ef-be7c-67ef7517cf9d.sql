-- Adicionar colunas de lateralidade/local da cirurgia
ALTER TABLE public.opme_requests 
ADD COLUMN IF NOT EXISTS procedure_side_cadastro TEXT,
ADD COLUMN IF NOT EXISTS procedure_side_requisicao TEXT;
