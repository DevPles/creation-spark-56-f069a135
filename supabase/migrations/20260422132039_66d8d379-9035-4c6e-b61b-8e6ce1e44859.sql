-- Catálogo de produtos
CREATE TABLE public.product_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL DEFAULT 'MMH',
  classificacao TEXT NOT NULL DEFAULT 'medico',
  descricao TEXT NOT NULL,
  unidade_medida TEXT NOT NULL DEFAULT 'UN',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view product_catalog" ON public.product_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert product_catalog" ON public.product_catalog FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "update product_catalog admin" ON public.product_catalog FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "delete product_catalog admin" ON public.product_catalog FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_product_catalog_updated
BEFORE UPDATE ON public.product_catalog
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Geração automática do código TIPO-CLASS-NNNN
CREATE OR REPLACE FUNCTION public.gen_product_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefix TEXT;
  next_num INT;
BEGIN
  IF NEW.codigo IS NOT NULL AND length(NEW.codigo) > 0 THEN
    RETURN NEW;
  END IF;
  prefix := upper(coalesce(NEW.tipo,'GEN')) || '-' || upper(substr(coalesce(NEW.classificacao,'GEN'),1,4));
  SELECT COALESCE(MAX((regexp_replace(codigo, '^.*-', ''))::int), 0) + 1
    INTO next_num
    FROM public.product_catalog
    WHERE codigo LIKE prefix || '-%';
  NEW.codigo := prefix || '-' || lpad(next_num::text, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_catalog_code
BEFORE INSERT ON public.product_catalog
FOR EACH ROW EXECUTE FUNCTION public.gen_product_code();

-- Seed dos 35 itens (MMH / medico)
INSERT INTO public.product_catalog (tipo, classificacao, descricao, unidade_medida) VALUES
('MMH','medico','Seringa 10 ml','UN'),
('MMH','medico','Agulha Hipodermica Descartável 40x12','UN'),
('MMH','medico','Compressa de Gaze 7,5 cm x 7,5 cm esteril 13 F PCT com 10 Unidades','PCT'),
('MMH','medico','Equipo Macrogotas com Injetor Lateral','UN'),
('MMH','medico','Seringa 20 ml','UN'),
('MMH','medico','Mascara Descartavel Retangular Tripla Falso Tecido com Elastico','UN'),
('MMH','medico','Turbante Descartável em Falso Tecido (Touca)','UN'),
('MMH','medico','Fralda Descartável Geriatrica GG com Gelate até 120 KG','UN'),
('MMH','medico','Avental Descartável Branco Falso Tecido Manga Longa com Punho 30G','UN'),
('MMH','medico','Seringa 05 ml','UN'),
('MMH','medico','Agulha Hipodermica Descartável 30x07','UN'),
('MMH','medico','Seringa 03 ml','UN'),
('MMH','medico','Agulha Hipodermica Descartel 30x08','UN'),
('MMH','medico','Pulseira para Identicação cor verde','UN'),
('MMH','medico','Espatula abaixador de lingua de madeira','UN'),
('MMH','medico','Tampa Protetora para Seringa (Luer Slip/Lock)','UN'),
('MMH','medico','Cateter Intravenoso Periférico de Segurança nº 22 (jelco)','UN'),
('MMH','medico','Seringa 01 ml com agulha','UN'),
('MMH','medico','Pulseira para identificação cor azul','UN'),
('MMH','medico','Cateter Intravenoso Periférico de Segurança nº 20 (jelco)','UN'),
('MMH','medico','Torneira Descartável 3 vias com Luer Look','UN'),
('MMH','medico','Swab Alcool Sache (compressa de não tecido embebida em alcool Isopropilico 70%)','UN'),
('MMH','medico','Puseira p/ identificação cor amarela','UN'),
('MMH','medico','Scalp 23g com Dispositivo de segurança','UN'),
('MMH','medico','Scalp 21g com Dispositivo de segurança','UN'),
('MMH','medico','Campo Operatório Estéril 25x28cm (pct com 5 unidades)','PCT'),
('MMH','medico','Luva Cirurgica Esterilizada nº 7,5','PAR'),
('MMH','medico','Extensão em Y de 2 Vias Adulto (polifix)','UN'),
('MMH','medico','Escova para unhas com solução Clorexidina','UN'),
('MMH','medico','Compressa de Gaze 15 cm x 30 cm esteril (zobec)','UN'),
('MMH','medico','Envelope Wraps Pesado 1,20 x 1,20 60g Azul (SMS)','UN'),
('MMH','medico','Fixador e estabilizador de Cateter, Adesivo Transparente esteril Tamanho 6x7 cm','UN'),
('MMH','medico','Fita Integradora para Estelização a vapor (classe VI 7min/134 - 20min/121','UN'),
('MMH','medico','Cateter Intravenoso Periférico de Segurança nº 24 (Jelco)','UN'),
('MMH','medico','Fralda Descartável Recem-Nascido até 5kg (tamanho P)','UN');