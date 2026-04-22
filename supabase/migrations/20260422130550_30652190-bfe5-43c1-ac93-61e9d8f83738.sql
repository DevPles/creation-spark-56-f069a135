-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.purchase_requisition_status AS ENUM (
  'rascunho', 'aguardando_cotacao', 'em_cotacao', 'cotacao_concluida',
  'em_oc', 'finalizada', 'cancelada'
);

CREATE TYPE public.purchase_quotation_status AS ENUM (
  'rascunho', 'em_andamento', 'concluida', 'cancelada'
);

CREATE TYPE public.purchase_order_status AS ENUM (
  'aguardando_aprovacao', 'autorizada', 'negada', 'enviada', 'recebida', 'cancelada'
);

-- =========================================
-- REQUISITIONS
-- =========================================
CREATE TABLE public.purchase_requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  facility_unit text NOT NULL,
  setor text,
  municipio text,
  classificacao text[] NOT NULL DEFAULT '{}',
  justificativa_tipo text NOT NULL DEFAULT 'mensal',
  observacoes text,
  status public.purchase_requisition_status NOT NULL DEFAULT 'rascunho',
  solicitante_id uuid,
  solicitante_nome text,
  aprovador_imediato_nome text,
  aprovador_diretoria_nome text,
  data_requisicao date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_requisition_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  item_num integer NOT NULL DEFAULT 1,
  descricao text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 0,
  unidade_medida text NOT NULL DEFAULT 'UN',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pri_req ON public.purchase_requisition_items(requisition_id);

-- =========================================
-- QUOTATIONS
-- =========================================
CREATE TABLE public.purchase_quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  requisition_id uuid NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  facility_unit text NOT NULL,
  setor_comprador text,
  data_cotacao date NOT NULL DEFAULT CURRENT_DATE,
  status public.purchase_quotation_status NOT NULL DEFAULT 'rascunho',
  winner_supplier text,
  total_winner numeric DEFAULT 0,
  observacoes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_quotation_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.purchase_quotations(id) ON DELETE CASCADE,
  slot text NOT NULL DEFAULT '1',
  fornecedor_nome text NOT NULL,
  fornecedor_cnpj text,
  prazo_entrega text,
  condicao_pagamento text,
  fonte text NOT NULL DEFAULT 'manual',
  total numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pqs_quot ON public.purchase_quotation_suppliers(quotation_id);

CREATE TABLE public.purchase_quotation_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.purchase_quotations(id) ON DELETE CASCADE,
  requisition_item_id uuid NOT NULL REFERENCES public.purchase_requisition_items(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.purchase_quotation_suppliers(id) ON DELETE CASCADE,
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  is_winner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pqp_quot ON public.purchase_quotation_prices(quotation_id);
CREATE INDEX idx_pqp_supplier ON public.purchase_quotation_prices(supplier_id);

-- =========================================
-- PRICE HISTORY
-- =========================================
CREATE TABLE public.price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao_produto text NOT NULL,
  categoria text,
  unidade_medida text DEFAULT 'UN',
  valor_unitario numeric NOT NULL,
  fornecedor_nome text,
  fornecedor_cnpj text,
  fonte_url text,
  data_referencia date NOT NULL DEFAULT CURRENT_DATE,
  fonte text NOT NULL DEFAULT 'cotacao',
  quotation_id uuid REFERENCES public.purchase_quotations(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_history_desc ON public.price_history(descricao_produto);
CREATE INDEX idx_price_history_fonte ON public.price_history(fonte);

-- =========================================
-- PURCHASE ORDERS
-- =========================================
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  quotation_id uuid REFERENCES public.purchase_quotations(id) ON DELETE SET NULL,
  requisition_id uuid REFERENCES public.purchase_requisitions(id) ON DELETE SET NULL,
  facility_unit text NOT NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  rubrica_id text,
  rubrica_name text,
  fornecedor_nome text NOT NULL,
  fornecedor_cnpj text,
  endereco_entrega text,
  cnpj_emissao_nf text,
  texto_obrigatorio_nf text,
  prazo_entrega text,
  valor_total numeric NOT NULL DEFAULT 0,
  status public.purchase_order_status NOT NULL DEFAULT 'aguardando_aprovacao',
  responsavel_emissao_nome text,
  cargo text,
  data_envio_fornecedor date,
  data_envio_setor date,
  aprovado_por uuid,
  aprovado_em timestamptz,
  motivo_negacao text,
  observacoes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_num integer NOT NULL DEFAULT 1,
  descricao text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 0,
  unidade_medida text NOT NULL DEFAULT 'UN',
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_poi_po ON public.purchase_order_items(purchase_order_id);

-- =========================================
-- AUDIT LOG
-- =========================================
CREATE TABLE public.purchase_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  field_changed text,
  old_value text,
  new_value text,
  motivo text,
  changed_by uuid NOT NULL,
  changed_by_name text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pal_entity ON public.purchase_audit_log(entity_type, entity_id);

-- =========================================
-- TRIGGERS — updated_at
-- =========================================
CREATE TRIGGER pr_updated_at BEFORE UPDATE ON public.purchase_requisitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER pq_updated_at BEFORE UPDATE ON public.purchase_quotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER po_updated_at BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- RLS
-- =========================================
ALTER TABLE public.purchase_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requisition_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_quotation_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_quotation_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_audit_log ENABLE ROW LEVEL SECURITY;

-- Requisitions
CREATE POLICY "view requisitions" ON public.purchase_requisitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert requisitions" ON public.purchase_requisitions FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "update requisitions" ON public.purchase_requisitions FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "delete requisitions" ON public.purchase_requisitions FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Requisition items
CREATE POLICY "view req items" ON public.purchase_requisition_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert req items" ON public.purchase_requisition_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update req items" ON public.purchase_requisition_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "delete req items" ON public.purchase_requisition_items FOR DELETE TO authenticated USING (true);

-- Quotations
CREATE POLICY "view quotations" ON public.purchase_quotations FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert quotations" ON public.purchase_quotations FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "update quotations" ON public.purchase_quotations FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "delete quotations" ON public.purchase_quotations FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "view qsup" ON public.purchase_quotation_suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert qsup" ON public.purchase_quotation_suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update qsup" ON public.purchase_quotation_suppliers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "delete qsup" ON public.purchase_quotation_suppliers FOR DELETE TO authenticated USING (true);

CREATE POLICY "view qprices" ON public.purchase_quotation_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert qprices" ON public.purchase_quotation_prices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update qprices" ON public.purchase_quotation_prices FOR UPDATE TO authenticated USING (true);
CREATE POLICY "delete qprices" ON public.purchase_quotation_prices FOR DELETE TO authenticated USING (true);

-- Price history
CREATE POLICY "view price_history" ON public.price_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert price_history" ON public.price_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "delete price_history" ON public.price_history FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Purchase orders
CREATE POLICY "view orders" ON public.purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert orders" ON public.purchase_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "update orders" ON public.purchase_orders FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "delete orders" ON public.purchase_orders FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "view order items" ON public.purchase_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert order items" ON public.purchase_order_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update order items" ON public.purchase_order_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "delete order items" ON public.purchase_order_items FOR DELETE TO authenticated USING (true);

-- Audit log
CREATE POLICY "view audit" ON public.purchase_audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert audit" ON public.purchase_audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = changed_by);

-- =========================================
-- STORAGE BUCKET
-- =========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('purchase-attachments', 'purchase-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth view purchase attachments" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'purchase-attachments');
CREATE POLICY "auth insert purchase attachments" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'purchase-attachments');
CREATE POLICY "auth delete purchase attachments" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'purchase-attachments');