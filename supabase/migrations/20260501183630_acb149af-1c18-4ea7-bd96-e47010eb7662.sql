-- Etapa 1 do faturamento OPME completo
-- Novos campos para AIH (Tela 2), validações e fechamento (Telas 9-12)

ALTER TABLE public.opme_requests
  -- Tela 2: AIH
  ADD COLUMN IF NOT EXISTS billing_aih_type text,
  ADD COLUMN IF NOT EXISTS billing_admission_date date,
  ADD COLUMN IF NOT EXISTS billing_discharge_date date,
  ADD COLUMN IF NOT EXISTS billing_cnes text,
  ADD COLUMN IF NOT EXISTS billing_cid_main text,
  ADD COLUMN IF NOT EXISTS billing_cid_secondary text,
  ADD COLUMN IF NOT EXISTS billing_exit_reason text,
  ADD COLUMN IF NOT EXISTS billing_attendance_character text,
  -- Tela 10: Glosa
  ADD COLUMN IF NOT EXISTS billing_glosa_risk text, -- baixo | medio | alto
  ADD COLUMN IF NOT EXISTS billing_glosa_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS billing_glosa_observations text,
  -- Tela 9: Validação SUS (snapshot do resultado calculado)
  ADD COLUMN IF NOT EXISTS billing_validation_result text, -- apto | ressalva | bloqueado
  ADD COLUMN IF NOT EXISTS billing_validation_checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Tela 12: Fechamento
  ADD COLUMN IF NOT EXISTS billing_responsible_name text,
  ADD COLUMN IF NOT EXISTS billing_closed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS billing_final_observations text,
  ADD COLUMN IF NOT EXISTS billing_final_status text; -- faturado | bloqueado | pendente | com_ressalva
