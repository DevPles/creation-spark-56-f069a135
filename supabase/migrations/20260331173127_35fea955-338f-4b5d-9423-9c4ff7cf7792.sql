
-- Training modules table
CREATE TABLE public.training_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  video_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Training ratings table (heart system 1-5)
CREATE TABLE public.training_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(module_id, user_id)
);

ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_ratings ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view training modules
CREATE POLICY "Anyone can view training modules" ON public.training_modules FOR SELECT TO authenticated USING (true);

-- Only admins can manage training modules
CREATE POLICY "Admins can insert training modules" ON public.training_modules FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update training modules" ON public.training_modules FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete training modules" ON public.training_modules FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Everyone can view ratings, users can manage own ratings
CREATE POLICY "Anyone can view ratings" ON public.training_ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own rating" ON public.training_ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rating" ON public.training_ratings FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Seed default training modules
INSERT INTO public.training_modules (title, description, sort_order) VALUES
  ('Dashboard', 'Visão geral dos indicadores e KPIs. Clique em qualquer card para acessar o módulo correspondente.', 1),
  ('Metas', 'Cadastro e acompanhamento de metas qualitativas e quantitativas por unidade.', 2),
  ('Lançamento de Metas', 'Registro de valores realizados por meta, com seleção de período e notas.', 3),
  ('Contratos', 'Gestão de contratos de gestão, com upload de PDF, rubricas e valores globais.', 4),
  ('Controle de Rubrica', 'Dashboard financeiro de acompanhamento de rubricas alocadas vs executadas por contrato.', 5),
  ('Evidências', 'Upload e validação de documentos comprobatórios. Pendências de rubricas estouradas aparecem automaticamente.', 6),
  ('Relatórios', 'Geração de relatórios em PDF e visualização de gráficos consolidados com carrossel.', 7),
  ('Risco', 'Matriz de risco e acompanhamento de indicadores críticos por unidade.', 8),
  ('SAU', 'Módulo de acompanhamento do Serviço de Atendimento ao Usuário.', 9),
  ('Administração', 'Gestão de usuários, papéis e permissões do sistema (apenas administradores).', 10);
