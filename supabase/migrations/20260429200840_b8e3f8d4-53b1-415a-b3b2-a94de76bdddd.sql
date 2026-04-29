-- Adicionar novos valores ao enum opme_status se não existirem
DO $$ BEGIN
    ALTER TYPE public.opme_status ADD VALUE IF NOT EXISTS 'pendente_requisicao';
    ALTER TYPE public.opme_status ADD VALUE IF NOT EXISTS 'pendente_auditoria';
    ALTER TYPE public.opme_status ADD VALUE IF NOT EXISTS 'pendente_faturamento';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;