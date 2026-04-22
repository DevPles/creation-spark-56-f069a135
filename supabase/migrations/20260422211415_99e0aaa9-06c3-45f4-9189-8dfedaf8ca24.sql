-- 1. Status de qualificação no fornecedor
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS qualificacao_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS qualificacao_observacoes text,
  ADD COLUMN IF NOT EXISTS liberado_por uuid,
  ADD COLUMN IF NOT EXISTS liberado_em timestamptz,
  ADD COLUMN IF NOT EXISTS liberado_motivo text,
  ADD COLUMN IF NOT EXISTS fornece_medicamentos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inidoneo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.suppliers.qualificacao_status IS 'pendente | habilitado | liberado_admin | inidoneo';

-- 2. Tabela de documentos do fornecedor (Art. 9º)
CREATE TABLE IF NOT EXISTS public.supplier_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  doc_key text NOT NULL,
  doc_label text NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  validade date,
  observacoes text,
  uploaded_by uuid NOT NULL,
  uploaded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, doc_key)
);

CREATE INDEX IF NOT EXISTS idx_supplier_documents_supplier ON public.supplier_documents(supplier_id);

ALTER TABLE public.supplier_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view supplier_documents"
  ON public.supplier_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "insert supplier_documents"
  ON public.supplier_documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "update supplier_documents owner or admin"
  ON public.supplier_documents FOR UPDATE TO authenticated
  USING (auth.uid() = uploaded_by OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "delete supplier_documents owner or admin"
  ON public.supplier_documents FOR DELETE TO authenticated
  USING (auth.uid() = uploaded_by OR has_role(auth.uid(), 'admin'::app_role));

-- 3. Bucket de storage (privado — auditável)
INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-documents', 'supplier-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can view supplier-documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'supplier-documents');

CREATE POLICY "Authenticated can upload supplier-documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'supplier-documents');

CREATE POLICY "Authenticated can update supplier-documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'supplier-documents');

CREATE POLICY "Owner or admin can delete supplier-documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'supplier-documents' AND (auth.uid() = owner OR has_role(auth.uid(), 'admin'::app_role)));

-- 4. Atualizar get_order_dossier para incluir documentos do fornecedor vencedor
CREATE OR REPLACE FUNCTION public.get_order_dossier(_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.purchase_orders%ROWTYPE;
  v_req public.purchase_requisitions%ROWTYPE;
  v_quotation public.purchase_quotations%ROWTYPE;
  v_contract public.contracts%ROWTYPE;
  v_creator_name text;
  v_solicitante_name text;
  v_items jsonb;
  v_req_items jsonb;
  v_invites jsonb;
  v_quote_suppliers jsonb;
  v_quote_prices jsonb;
  v_approval jsonb;
  v_audit jsonb;
  v_rubrica jsonb;
  v_rubrica_percent numeric := 0;
  v_rubrica_budget numeric := 0;
  v_rubrica_spent numeric := 0;
  v_winner_supplier public.suppliers%ROWTYPE;
  v_winner_docs jsonb;
  v_winner_obj jsonb;
BEGIN
  SELECT * INTO v_order FROM public.purchase_orders WHERE id = _order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','order_not_found'); END IF;

  SELECT name INTO v_creator_name FROM public.profiles WHERE id = v_order.created_by;

  IF v_order.requisition_id IS NOT NULL THEN
    SELECT * INTO v_req FROM public.purchase_requisitions WHERE id = v_order.requisition_id;
    IF v_req.solicitante_id IS NOT NULL THEN
      SELECT name INTO v_solicitante_name FROM public.profiles WHERE id = v_req.solicitante_id;
    END IF;
  END IF;

  IF v_order.quotation_id IS NOT NULL THEN
    SELECT * INTO v_quotation FROM public.purchase_quotations WHERE id = v_order.quotation_id;
  END IF;

  IF v_order.contract_id IS NOT NULL THEN
    SELECT * INTO v_contract FROM public.contracts WHERE id = v_order.contract_id;
    IF FOUND AND v_order.rubrica_id IS NOT NULL THEN
      SELECT r INTO v_rubrica
        FROM jsonb_array_elements(COALESCE(v_contract.rubricas,'[]'::jsonb)) r
       WHERE r->>'id' = v_order.rubrica_id
       LIMIT 1;
      IF v_rubrica IS NOT NULL THEN
        v_rubrica_percent := COALESCE((v_rubrica->>'percent')::numeric, 0);
        v_rubrica_budget := COALESCE(v_contract.value, 0) * v_rubrica_percent / 100.0;
      END IF;
      SELECT COALESCE(SUM(valor_total), 0)
        INTO v_rubrica_spent
        FROM public.purchase_orders
       WHERE contract_id = v_order.contract_id
         AND rubrica_id = v_order.rubrica_id
         AND id <> v_order.id
         AND status IN ('autorizada','enviada','recebida');
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'item_num', item_num, 'descricao', descricao, 'quantidade', quantidade,
    'unidade_medida', unidade_medida, 'valor_unitario', valor_unitario, 'valor_total', valor_total
  ) ORDER BY item_num), '[]'::jsonb)
  INTO v_items FROM public.purchase_order_items WHERE purchase_order_id = v_order.id;

  IF v_order.requisition_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'item_num', i.item_num,
      'descricao', i.descricao,
      'quantidade', i.quantidade,
      'unidade_medida', i.unidade_medida,
      'observacao', i.observacao,
      'codigo', pc.codigo,
      'setor', COALESCE(pc.setor, v_req.setor),
      'image_url', pc.image_url
    ) ORDER BY i.item_num), '[]'::jsonb)
    INTO v_req_items
    FROM public.purchase_requisition_items i
    LEFT JOIN public.product_catalog pc ON pc.id = i.product_id
    WHERE i.requisition_id = v_order.requisition_id;
  ELSE
    v_req_items := '[]'::jsonb;
  END IF;

  IF v_order.requisition_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', qi.id,
      'fornecedor_nome', qi.fornecedor_nome,
      'fornecedor_cnpj', qi.fornecedor_cnpj,
      'fornecedor_email', qi.fornecedor_email,
      'fornecedor_telefone', qi.fornecedor_telefone,
      'status', qi.status,
      'created_at', qi.created_at,
      'submitted_at', qi.submitted_at,
      'submission_ip', qi.submission_ip,
      'expires_at', qi.expires_at,
      'prazo_entrega', qi.prazo_entrega,
      'condicao_pagamento', qi.condicao_pagamento,
      'responder_name', qi.responder_name,
      'responder_email', qi.responder_email,
      'responder_phone', qi.responder_phone,
      'responder_cpf', qi.responder_cpf
    ) ORDER BY qi.created_at), '[]'::jsonb)
    INTO v_invites
    FROM public.quotation_invites qi
    WHERE qi.requisition_id = v_order.requisition_id;
  ELSE
    v_invites := '[]'::jsonb;
  END IF;

  IF v_quotation.id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'slot', s.slot,
      'fornecedor_nome', s.fornecedor_nome,
      'fornecedor_cnpj', s.fornecedor_cnpj,
      'prazo_entrega', s.prazo_entrega,
      'condicao_pagamento', s.condicao_pagamento,
      'fonte', s.fonte,
      'total', s.total,
      'submission_ip', s.submission_ip,
      'created_at', s.created_at
    ) ORDER BY s.slot), '[]'::jsonb)
    INTO v_quote_suppliers
    FROM public.purchase_quotation_suppliers s
    WHERE s.quotation_id = v_quotation.id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'requisition_item_id', p.requisition_item_id,
      'supplier_id', p.supplier_id,
      'valor_unitario', p.valor_unitario,
      'valor_total', p.valor_total,
      'is_winner', p.is_winner
    )), '[]'::jsonb)
    INTO v_quote_prices
    FROM public.purchase_quotation_prices p
    WHERE p.quotation_id = v_quotation.id;
  ELSE
    v_quote_suppliers := '[]'::jsonb;
    v_quote_prices := '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'created_at', a.created_at,
    'expires_at', a.expires_at,
    'signed_at', a.signed_at,
    'decision', a.decision,
    'approver_name', a.approver_name,
    'approver_cargo', a.approver_cargo,
    'approver_email', a.approver_email,
    'approver_ip', a.approver_ip,
    'ciencia_lgpd', a.ciencia_lgpd,
    'motivo_recusa', a.motivo_recusa
  ) ORDER BY a.created_at), '[]'::jsonb)
  INTO v_approval
  FROM public.purchase_order_approvals a
  WHERE a.purchase_order_id = v_order.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'changed_at', l.changed_at,
    'entity_type', l.entity_type,
    'entity_id', l.entity_id,
    'action', l.action,
    'field_changed', l.field_changed,
    'old_value', l.old_value,
    'new_value', l.new_value,
    'changed_by_name', l.changed_by_name,
    'motivo', l.motivo
  ) ORDER BY l.changed_at), '[]'::jsonb)
  INTO v_audit
  FROM public.purchase_audit_log l
  WHERE l.entity_id IN (
    SELECT _order_id
    UNION SELECT v_order.requisition_id WHERE v_order.requisition_id IS NOT NULL
    UNION SELECT v_order.quotation_id WHERE v_order.quotation_id IS NOT NULL
    UNION SELECT id FROM public.quotation_invites WHERE requisition_id = v_order.requisition_id
    UNION SELECT id FROM public.purchase_order_approvals WHERE purchase_order_id = v_order.id
  );

  -- ===== Fornecedor vencedor (qualificação Art. 9º) =====
  v_winner_obj := NULL;
  v_winner_docs := '[]'::jsonb;
  IF v_order.fornecedor_cnpj IS NOT NULL THEN
    SELECT * INTO v_winner_supplier
      FROM public.suppliers
     WHERE cnpj = regexp_replace(v_order.fornecedor_cnpj, '[^0-9]', '', 'g')
     LIMIT 1;
    IF FOUND THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'doc_key', d.doc_key,
        'doc_label', d.doc_label,
        'file_url', d.file_url,
        'file_name', d.file_name,
        'validade', d.validade,
        'uploaded_by_name', d.uploaded_by_name,
        'created_at', d.created_at
      ) ORDER BY d.doc_key), '[]'::jsonb)
      INTO v_winner_docs
      FROM public.supplier_documents d
      WHERE d.supplier_id = v_winner_supplier.id;

      v_winner_obj := jsonb_build_object(
        'id', v_winner_supplier.id,
        'nome', v_winner_supplier.nome,
        'cnpj', v_winner_supplier.cnpj,
        'qualificacao_status', v_winner_supplier.qualificacao_status,
        'qualificacao_observacoes', v_winner_supplier.qualificacao_observacoes,
        'liberado_em', v_winner_supplier.liberado_em,
        'liberado_motivo', v_winner_supplier.liberado_motivo,
        'fornece_medicamentos', v_winner_supplier.fornece_medicamentos,
        'inidoneo', v_winner_supplier.inidoneo,
        'documents', v_winner_docs
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_order.id,
      'numero', v_order.numero,
      'facility_unit', v_order.facility_unit,
      'fornecedor_nome', v_order.fornecedor_nome,
      'fornecedor_cnpj', v_order.fornecedor_cnpj,
      'cnpj_emissao_nf', v_order.cnpj_emissao_nf,
      'endereco_entrega', v_order.endereco_entrega,
      'prazo_entrega', v_order.prazo_entrega,
      'observacoes', v_order.observacoes,
      'valor_total', v_order.valor_total,
      'status', v_order.status,
      'created_at', v_order.created_at,
      'created_by_name', v_creator_name,
      'aprovado_em', v_order.aprovado_em,
      'rubrica_id', v_order.rubrica_id,
      'rubrica_name', v_order.rubrica_name
    ),
    'contract', CASE WHEN v_contract.id IS NOT NULL THEN jsonb_build_object(
      'id', v_contract.id, 'name', v_contract.name, 'value', v_contract.value,
      'rubrica_percent', v_rubrica_percent,
      'rubrica_budget', v_rubrica_budget,
      'rubrica_spent', v_rubrica_spent,
      'rubrica_remaining_after', GREATEST(v_rubrica_budget - v_rubrica_spent - COALESCE(v_order.valor_total,0), 0)
    ) ELSE NULL END,
    'requisition', CASE WHEN v_req.id IS NOT NULL THEN jsonb_build_object(
      'id', v_req.id, 'numero', v_req.numero, 'data_requisicao', v_req.data_requisicao,
      'created_at', v_req.created_at, 'setor', v_req.setor,
      'solicitante_nome', COALESCE(v_solicitante_name, v_req.solicitante_nome),
      'justificativa_tipo', v_req.justificativa_tipo,
      'classificacao', to_jsonb(v_req.classificacao),
      'observacoes', v_req.observacoes
    ) ELSE NULL END,
    'quotation', CASE WHEN v_quotation.id IS NOT NULL THEN jsonb_build_object(
      'id', v_quotation.id, 'numero', v_quotation.numero, 'data_cotacao', v_quotation.data_cotacao,
      'winner_supplier', v_quotation.winner_supplier, 'total_winner', v_quotation.total_winner,
      'created_at', v_quotation.created_at
    ) ELSE NULL END,
    'order_items', v_items,
    'requisition_items', v_req_items,
    'invites', v_invites,
    'quote_suppliers', v_quote_suppliers,
    'quote_prices', v_quote_prices,
    'approvals', v_approval,
    'audit_log', v_audit,
    'winner_supplier', v_winner_obj,
    'generated_at', now()
  );
END;
$function$;