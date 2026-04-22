-- 1. Tabela suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text NOT NULL UNIQUE,
  email text,
  telefone text,
  endereco text,
  contato_responsavel text,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_nome ON public.suppliers (nome);
CREATE INDEX IF NOT EXISTS idx_suppliers_ativo ON public.suppliers (ativo);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "delete suppliers admin" ON public.suppliers FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Coluna supplier_id em price_history
ALTER TABLE public.price_history ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_price_history_supplier_id ON public.price_history (supplier_id);
CREATE INDEX IF NOT EXISTS idx_price_history_data_ref ON public.price_history (data_referencia DESC);

-- 3. Função upsert_supplier_from_cnpj
CREATE OR REPLACE FUNCTION public.upsert_supplier_from_cnpj(_nome text, _cnpj text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_clean_cnpj text;
BEGIN
  v_clean_cnpj := NULLIF(regexp_replace(COALESCE(_cnpj, ''), '[^0-9]', '', 'g'), '');
  IF v_clean_cnpj IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_id FROM public.suppliers WHERE cnpj = v_clean_cnpj LIMIT 1;
  IF v_id IS NOT NULL THEN
    -- atualiza nome se vier um nome novo e o atual estiver vazio
    UPDATE public.suppliers
       SET nome = COALESCE(NULLIF(_nome,''), nome),
           updated_at = now()
     WHERE id = v_id AND (nome IS NULL OR nome = '' OR nome = cnpj);
    RETURN v_id;
  END IF;

  INSERT INTO public.suppliers (nome, cnpj, ativo)
  VALUES (COALESCE(NULLIF(_nome,''), v_clean_cnpj), v_clean_cnpj, true)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 4. Backfill: cria suppliers a partir dos CNPJs existentes em price_history
INSERT INTO public.suppliers (nome, cnpj, ativo)
SELECT
  COALESCE(MAX(NULLIF(fornecedor_nome,'')), regexp_replace(fornecedor_cnpj, '[^0-9]', '', 'g')) AS nome,
  regexp_replace(fornecedor_cnpj, '[^0-9]', '', 'g') AS cnpj,
  true
FROM public.price_history
WHERE fornecedor_cnpj IS NOT NULL
  AND regexp_replace(fornecedor_cnpj, '[^0-9]', '', 'g') <> ''
GROUP BY regexp_replace(fornecedor_cnpj, '[^0-9]', '', 'g')
ON CONFLICT (cnpj) DO NOTHING;

-- Vincula price_history aos suppliers criados
UPDATE public.price_history ph
   SET supplier_id = s.id
  FROM public.suppliers s
 WHERE ph.supplier_id IS NULL
   AND ph.fornecedor_cnpj IS NOT NULL
   AND regexp_replace(ph.fornecedor_cnpj, '[^0-9]', '', 'g') = s.cnpj;

-- 5. Atualiza submit_invite_response para alimentar price_history com supplier_id
CREATE OR REPLACE FUNCTION public.submit_invite_response(_token uuid, _prazo_entrega text, _condicao_pagamento text, _observacoes text, _responses jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.quotation_invites%ROWTYPE;
  v_quotation_id uuid;
  v_supplier_row_id uuid;
  v_supplier_id uuid;
  v_resp jsonb;
  v_total numeric := 0;
  v_slot text;
  v_existing_count int;
  v_qty numeric;
  v_valor numeric;
  v_disponivel boolean;
  v_desc text;
  v_um text;
BEGIN
  SELECT * INTO v_invite FROM public.quotation_invites WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'invite_not_found'); END IF;
  IF v_invite.expires_at < now() THEN RETURN jsonb_build_object('success', false, 'error', 'expired'); END IF;
  IF v_invite.submitted_at IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'already_submitted'); END IF;

  UPDATE public.quotation_invites
     SET status = 'respondido', submitted_at = now(),
         prazo_entrega = _prazo_entrega, condicao_pagamento = _condicao_pagamento, observacoes = _observacoes
   WHERE id = v_invite.id;

  DELETE FROM public.quotation_invite_responses WHERE invite_id = v_invite.id;

  -- Resolve/cria supplier pelo CNPJ
  v_supplier_id := public.upsert_supplier_from_cnpj(v_invite.fornecedor_nome, v_invite.fornecedor_cnpj);

  FOR v_resp IN SELECT * FROM jsonb_array_elements(_responses)
  LOOP
    v_valor := COALESCE((v_resp->>'valor_unitario')::numeric, 0);
    v_disponivel := COALESCE((v_resp->>'disponivel')::boolean, true);
    INSERT INTO public.quotation_invite_responses (invite_id, requisition_item_id, valor_unitario, disponivel, observacao)
    VALUES (v_invite.id, (v_resp->>'requisition_item_id')::uuid, v_valor, v_disponivel, v_resp->>'observacao');
    SELECT quantidade INTO v_qty FROM public.purchase_requisition_items WHERE id = (v_resp->>'requisition_item_id')::uuid;
    IF v_disponivel THEN v_total := v_total + (v_valor * COALESCE(v_qty, 0)); END IF;
  END LOOP;

  SELECT id INTO v_quotation_id FROM public.purchase_quotations WHERE requisition_id = v_invite.requisition_id LIMIT 1;
  IF v_quotation_id IS NULL THEN
    INSERT INTO public.purchase_quotations (requisition_id, facility_unit, numero, created_by, status)
    SELECT r.id, r.facility_unit, 'COT-' || to_char(now(),'YYYYMMDDHH24MISS'), v_invite.created_by, 'em_andamento'::purchase_quotation_status
      FROM public.purchase_requisitions r WHERE r.id = v_invite.requisition_id
    RETURNING id INTO v_quotation_id;
  END IF;

  SELECT count(*) INTO v_existing_count FROM public.purchase_quotation_suppliers WHERE quotation_id = v_quotation_id;
  IF v_existing_count = 0 THEN v_slot := '1';
  ELSIF v_existing_count = 1 THEN v_slot := '2';
  ELSIF v_existing_count = 2 THEN v_slot := '3';
  ELSE v_slot := 'extra'; END IF;

  DELETE FROM public.purchase_quotation_suppliers
   WHERE quotation_id = v_quotation_id
     AND fornecedor_nome = v_invite.fornecedor_nome
     AND COALESCE(fornecedor_cnpj,'') = COALESCE(v_invite.fornecedor_cnpj,'');

  INSERT INTO public.purchase_quotation_suppliers (quotation_id, slot, fornecedor_nome, fornecedor_cnpj, prazo_entrega, condicao_pagamento, fonte, total)
  VALUES (v_quotation_id, v_slot, v_invite.fornecedor_nome, v_invite.fornecedor_cnpj, _prazo_entrega, _condicao_pagamento, 'invite_link', v_total)
  RETURNING id INTO v_supplier_row_id;

  FOR v_resp IN SELECT * FROM jsonb_array_elements(_responses)
  LOOP
    v_valor := COALESCE((v_resp->>'valor_unitario')::numeric, 0);
    v_disponivel := COALESCE((v_resp->>'disponivel')::boolean, true);
    SELECT quantidade, descricao, unidade_medida INTO v_qty, v_desc, v_um
      FROM public.purchase_requisition_items WHERE id = (v_resp->>'requisition_item_id')::uuid;

    INSERT INTO public.purchase_quotation_prices (quotation_id, requisition_item_id, supplier_id, valor_unitario, valor_total, is_winner)
    VALUES (
      v_quotation_id, (v_resp->>'requisition_item_id')::uuid, v_supplier_row_id,
      CASE WHEN v_disponivel THEN v_valor ELSE 0 END,
      CASE WHEN v_disponivel THEN v_valor * COALESCE(v_qty,0) ELSE 0 END,
      false
    );

    -- Alimenta price_history (banco de preços) com supplier_id resolvido
    IF v_disponivel AND v_valor > 0 AND v_supplier_id IS NOT NULL THEN
      INSERT INTO public.price_history (
        descricao_produto, valor_unitario, unidade_medida,
        fornecedor_nome, fornecedor_cnpj, supplier_id,
        data_referencia, fonte, quotation_id, created_by
      ) VALUES (
        v_desc, v_valor, COALESCE(v_um,'UN'),
        v_invite.fornecedor_nome, v_invite.fornecedor_cnpj, v_supplier_id,
        CURRENT_DATE, 'cotacao_link', v_quotation_id, v_invite.created_by
      );
    END IF;
  END LOOP;

  INSERT INTO public.purchase_audit_log (entity_type, entity_id, action, changed_by, changed_by_name, motivo)
  VALUES ('quotation_invite', v_invite.id, 'submitted', v_invite.created_by, v_invite.fornecedor_nome, 'Resposta recebida via link público');

  RETURN jsonb_build_object('success', true, 'quotation_id', v_quotation_id);
END;
$$;