-- 1. Adicionar valor ao enum opme_status
ALTER TYPE public.opme_status ADD VALUE IF NOT EXISTS 'justificativa_respondida';

-- 2. Adicionar colunas para o fluxo da justificativa do cirurgião
ALTER TABLE public.opme_requests
  ADD COLUMN IF NOT EXISTS surgeon_justification text,
  ADD COLUMN IF NOT EXISTS surgeon_justification_at timestamptz,
  ADD COLUMN IF NOT EXISTS surgeon_justification_by text,
  ADD COLUMN IF NOT EXISTS surgeon_justification_attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS auditor_post_justification_decision text,
  ADD COLUMN IF NOT EXISTS auditor_post_justification_decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS auditor_post_justification_decision_notes text,
  ADD COLUMN IF NOT EXISTS justification_round integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS justification_history jsonb NOT NULL DEFAULT '[]'::jsonb;