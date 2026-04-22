-- ============================================
-- TABELAS
-- ============================================

CREATE TABLE public.quotation_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  fornecedor_nome text NOT NULL,
  fornecedor_cnpj text,
  fornecedor_email text,
  fornecedor_telefone text,
  status text NOT NULL DEFAULT 'pendente',
  prazo_entrega text,
  condicao_pagamento text,
  observacoes text,
  submitted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quotation_invites_token ON public.quotation_invites(token);
CREATE INDEX idx_quotation_invites_requisition ON public.quotation_invites(requisition_id);

CREATE TABLE public.quotation_invite_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.quotation_invites(id) ON DELETE CASCADE,
  requisition_item_id uuid NOT NULL REFERENCES public.purchase_requisition_items(id) ON DELETE CASCADE,
  valor_unitario numeric NOT NULL DEFAULT 0,
  disponivel boolean NOT NULL DEFAULT true,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(invite_id, requisition_item_id)
);

CREATE INDEX idx_invite_responses_invite ON public.quotation_invite_responses(invite_id);

-- ============================================
-- RLS
-- ============================================

ALTER TABLE public.quotation_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_invite_responses ENABLE ROW LEVEL SECURITY;

-- quotation_invites: somente autenticados (acesso público é via RPC)
CREATE POLICY "view invites" ON public.quotation_invites
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "insert invites" ON public.quotation_invites
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "update invites" ON public.quotation_invites
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "delete invites" ON public.quotation_invites
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- quotation_invite_responses: somente autenticados visualizam (insert público é via RPC)
CREATE POLICY "view invite responses" ON public.quotation_invite_responses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "delete invite responses" ON public.quotation_invite_responses
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- TRIGGER updated_at
-- ============================================

CREATE TRIGGER update_quotation_invites_updated_at
BEFORE UPDATE ON public.quotation_invites
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- FUNÇÃO PÚBLICA: get_invite_by_token
-- Retorna dados não-sensíveis para o fornecedor preencher
-- ============================================

CREATE OR REPLACE FUNCTION public.get_invite_by_token(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.quotation_invites%ROWTYPE;
  v_requisition public.purchase_requisitions%ROWTYPE;
  v_items jsonb;
  v_responses jsonb;
BEGIN
  SELECT * INTO v_invite FROM public.quotation_invites WHERE token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invite_not_found');
  END IF;

  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'expired', 'fornecedor_nome', v_invite.fornecedor_nome);
  END IF;

  SELECT * INTO v_requisition FROM public.purchase_requisitions WHERE id = v_invite.requisition_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'item_num', i.item_num,
    'descricao', i.descricao,
    'quantidade', i.quantidade,
    'unidade_medida', i.unidade_medida,
    'observacao', i.observacao
  ) ORDER BY i.item_num), '[]'::jsonb)
  INTO v_items
  FROM public.purchase_requisition_items i
  WHERE i.requisition_id = v_invite.requisition_id;

  -- Se já submeteu, devolve as respostas para exibir
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'requisition_item_id', r.requisition_item_id,
    'valor_unitario', r.valor_unitario,
    'disponivel', r.disponivel,
    'observacao', r.observacao
  )), '[]'::jsonb)
  INTO v_responses
  FROM public.quotation_invite_responses r
  WHERE r.invite_id = v_invite.id;

  RETURN jsonb_build_object(
    'invite', jsonb_build_object(
      'id', v_invite.id,
      'fornecedor_nome', v_invite.fornecedor_nome,
      'fornecedor_cnpj', v_invite.fornecedor_cnpj,
      'status', v_invite.status,
      'prazo_entrega', v_invite.prazo_entrega,
      'condicao_pagamento', v_invite.condicao_pagamento,
      'observacoes', v_invite.observacoes,
      'submitted_at', v_invite.submitted_at,
      'expires_at', v_invite.expires_at
    ),
    'requisition', jsonb_build_object(
      'id', v_requisition.id,
      'numero', v_requisition.numero,
      'facility_unit', v_requisition.facility_unit,
      'setor', v_requisition.setor,
      'data_requisicao', v_requisition.data_requisicao,
      'observacoes', v_requisition.observacoes
    ),
    'items', v_items,
    'responses', v_responses
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_by_token(uuid) TO anon, authenticated;

-- ============================================
-- FUNÇÃO PÚBLICA: submit_invite_response
-- Recebe a proposta do fornecedor e popula a cotação
-- ============================================

CREATE OR REPLACE FUNCTION public.submit_invite_response(
  _token uuid,
  _prazo_entrega text,
  _condicao_pagamento text,
  _observacoes text,
  _responses jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.quotation_invites%ROWTYPE;
  v_quotation_id uuid;
  v_supplier_id uuid;
  v_resp jsonb;
  v_total numeric := 0;
  v_slot text;
  v_existing_count int;
  v_qty numeric;
  v_valor numeric;
  v_disponivel boolean;
BEGIN
  SELECT * INTO v_invite FROM public.quotation_invites WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invite_not_found');
  END IF;

  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  IF v_invite.submitted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_submitted');
  END IF;

  -- Atualiza convite
  UPDATE public.quotation_invites
  SET status = 'respondido',
      submitted_at = now(),
      prazo_entrega = _prazo_entrega,
      condicao_pagamento = _condicao_pagamento,
      observacoes = _observacoes
  WHERE id = v_invite.id;

  -- Apaga respostas anteriores (não deveria ter, mas garantia)
  DELETE FROM public.quotation_invite_responses WHERE invite_id = v_invite.id;

  -- Insere respostas item a item
  FOR v_resp IN SELECT * FROM jsonb_array_elements(_responses)
  LOOP
    v_valor := COALESCE((v_resp->>'valor_unitario')::numeric, 0);
    v_disponivel := COALESCE((v_resp->>'disponivel')::boolean, true);

    INSERT INTO public.quotation_invite_responses (invite_id, requisition_item_id, valor_unitario, disponivel, observacao)
    VALUES (
      v_invite.id,
      (v_resp->>'requisition_item_id')::uuid,
      v_valor,
      v_disponivel,
      v_resp->>'observacao'
    );

    -- Soma total considerando quantidade
    SELECT quantidade INTO v_qty FROM public.purchase_requisition_items WHERE id = (v_resp->>'requisition_item_id')::uuid;
    IF v_disponivel THEN
      v_total := v_total + (v_valor * COALESCE(v_qty, 0));
    END IF;
  END LOOP;

  -- Garante que existe uma cotação para a requisição
  SELECT id INTO v_quotation_id FROM public.purchase_quotations
   WHERE requisition_id = v_invite.requisition_id LIMIT 1;

  IF v_quotation_id IS NULL THEN
    INSERT INTO public.purchase_quotations (
      requisition_id, facility_unit, numero, created_by, status
    )
    SELECT
      r.id,
      r.facility_unit,
      'COT-' || to_char(now(),'YYYYMMDDHH24MISS'),
      v_invite.created_by,
      'em_andamento'::purchase_quotation_status
    FROM public.purchase_requisitions r WHERE r.id = v_invite.requisition_id
    RETURNING id INTO v_quotation_id;
  END IF;

  -- Define slot do fornecedor (próximo disponível 1, 2, 3, depois extra)
  SELECT count(*) INTO v_existing_count FROM public.purchase_quotation_suppliers WHERE quotation_id = v_quotation_id;
  IF v_existing_count = 0 THEN v_slot := '1';
  ELSIF v_existing_count = 1 THEN v_slot := '2';
  ELSIF v_existing_count = 2 THEN v_slot := '3';
  ELSE v_slot := 'extra'; END IF;

  -- Insere fornecedor (apaga prévio do mesmo invite se reenvio futuro)
  DELETE FROM public.purchase_quotation_suppliers
   WHERE quotation_id = v_quotation_id
     AND fornecedor_nome = v_invite.fornecedor_nome
     AND COALESCE(fornecedor_cnpj,'') = COALESCE(v_invite.fornecedor_cnpj,'');

  INSERT INTO public.purchase_quotation_suppliers (
    quotation_id, slot, fornecedor_nome, fornecedor_cnpj, prazo_entrega, condicao_pagamento, fonte, total
  ) VALUES (
    v_quotation_id, v_slot, v_invite.fornecedor_nome, v_invite.fornecedor_cnpj,
    _prazo_entrega, _condicao_pagamento, 'invite_link', v_total
  ) RETURNING id INTO v_supplier_id;

  -- Insere preços por item
  FOR v_resp IN SELECT * FROM jsonb_array_elements(_responses)
  LOOP
    v_valor := COALESCE((v_resp->>'valor_unitario')::numeric, 0);
    v_disponivel := COALESCE((v_resp->>'disponivel')::boolean, true);
    SELECT quantidade INTO v_qty FROM public.purchase_requisition_items WHERE id = (v_resp->>'requisition_item_id')::uuid;

    INSERT INTO public.purchase_quotation_prices (
      quotation_id, requisition_item_id, supplier_id, valor_unitario, valor_total, is_winner
    ) VALUES (
      v_quotation_id,
      (v_resp->>'requisition_item_id')::uuid,
      v_supplier_id,
      CASE WHEN v_disponivel THEN v_valor ELSE 0 END,
      CASE WHEN v_disponivel THEN v_valor * COALESCE(v_qty,0) ELSE 0 END,
      false
    );
  END LOOP;

  -- Auditoria
  INSERT INTO public.purchase_audit_log (entity_type, entity_id, action, changed_by, changed_by_name, motivo)
  VALUES ('quotation_invite', v_invite.id, 'submitted', v_invite.created_by, v_invite.fornecedor_nome,
          'Resposta recebida via link público');

  RETURN jsonb_build_object('success', true, 'quotation_id', v_quotation_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_invite_response(uuid, text, text, text, jsonb) TO anon, authenticated;