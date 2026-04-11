
-- Enums for action plans
CREATE TYPE public.problem_type AS ENUM ('processo', 'equipamento', 'rh', 'insumo', 'infraestrutura', 'outro');
CREATE TYPE public.action_priority AS ENUM ('baixa', 'media', 'alta', 'critica');
CREATE TYPE public.action_status AS ENUM ('nao_iniciada', 'em_andamento', 'concluida', 'cancelada');
CREATE TYPE public.evidence_status AS ENUM ('pendente', 'enviada', 'validada', 'rejeitada');

-- Main action plans table
CREATE TABLE public.action_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_unit TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'meta',
  reference_name TEXT NOT NULL,
  reference_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  analise_critica TEXT,
  causa_raiz TEXT,
  acao_corretiva TEXT,
  responsavel TEXT,
  prazo DATE,
  status_acao public.action_status NOT NULL DEFAULT 'nao_iniciada',
  status_evidencia public.evidence_status NOT NULL DEFAULT 'pendente',
  tipo_evidencia TEXT,
  arquivo_url TEXT,
  area TEXT,
  tipo_problema public.problem_type NOT NULL DEFAULT 'outro',
  prioridade public.action_priority NOT NULL DEFAULT 'media',
  risco_financeiro NUMERIC DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- History / audit trail table
CREATE TABLE public.action_plan_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_plan_id UUID NOT NULL REFERENCES public.action_plans(id) ON DELETE CASCADE,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_plan_history ENABLE ROW LEVEL SECURITY;

-- RLS for action_plans
CREATE POLICY "Authenticated can view action_plans"
  ON public.action_plans FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own action_plans"
  ON public.action_plans FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator or admin can update action_plans"
  ON public.action_plans FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Creator or admin can delete action_plans"
  ON public.action_plans FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

-- RLS for action_plan_history (append-only audit)
CREATE POLICY "Authenticated can view action_plan_history"
  ON public.action_plan_history FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert action_plan_history"
  ON public.action_plan_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = changed_by);

-- Updated_at trigger for action_plans
CREATE TRIGGER update_action_plans_updated_at
  BEFORE UPDATE ON public.action_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for action_plans
ALTER PUBLICATION supabase_realtime ADD TABLE public.action_plans;
