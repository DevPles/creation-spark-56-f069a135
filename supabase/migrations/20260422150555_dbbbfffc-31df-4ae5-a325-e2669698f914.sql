CREATE TABLE IF NOT EXISTS public.purchase_order_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  approver_name text,
  approver_cargo text,
  approver_email text,
  approver_ip text,
  signed_at timestamptz,
  decision text,
  motivo_recusa text,
  ciencia_lgpd boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_poa_order ON public.purchase_order_approvals(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_poa_token ON public.purchase_order_approvals(token);

ALTER TABLE public.purchase_order_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view approvals" ON public.purchase_order_approvals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "insert approvals" ON public.purchase_order_approvals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "delete approvals admin" ON public.purchase_order_approvals
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_order_for_approval(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appr public.purchase_order_approvals%ROWTYPE;
  v_order public.purchase_orders%ROWTYPE;
  v_items jsonb;
  v_req_numero text;
BEGIN
  SELECT * INTO v_appr FROM public.purchase_order_approvals WHERE token = _token;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF v_appr.expires_at < now() THEN RETURN jsonb_build_object('error','expired'); END IF;
  SELECT * INTO v_order FROM public.purchase_orders WHERE id = v_appr.purchase_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','order_missing'); END IF;
  SELECT numero INTO v_req_numero FROM public.purchase_requisitions WHERE id = v_order.requisition_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'item_num', item_num,'descricao', descricao,'quantidade', quantidade,
    'unidade_medida', unidade_medida,'valor_unitario', valor_unitario,'valor_total', valor_total
  ) ORDER BY item_num), '[]'::jsonb)
  INTO v_items FROM public.purchase_order_items WHERE purchase_order_id = v_order.id;
  RETURN jsonb_build_object(
    'approval', jsonb_build_object(
      'id', v_appr.id,'expires_at', v_appr.expires_at,'signed_at', v_appr.signed_at,
      'decision', v_appr.decision,'approver_name', v_appr.approver_name,
      'approver_cargo', v_appr.approver_cargo,'motivo_recusa', v_appr.motivo_recusa
    ),
    'order', jsonb_build_object(
      'id', v_order.id,'numero', v_order.numero,'requisicao_numero', v_req_numero,
      'facility_unit', v_order.facility_unit,'fornecedor_nome', v_order.fornecedor_nome,
      'fornecedor_cnpj', v_order.fornecedor_cnpj,'endereco_entrega', v_order.endereco_entrega,
      'prazo_entrega', v_order.prazo_entrega,'rubrica_name', v_order.rubrica_name,
      'observacoes', v_order.observacoes,'valor_total', v_order.valor_total,'status', v_order.status
    ),
    'items', v_items
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_order_approval(
  _token uuid, _decision text, _approver_name text, _approver_cargo text,
  _approver_email text, _ip text, _motivo_recusa text, _ciencia boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_appr public.purchase_order_approvals%ROWTYPE;
BEGIN
  SELECT * INTO v_appr FROM public.purchase_order_approvals WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  IF v_appr.expires_at < now() THEN RETURN jsonb_build_object('success', false, 'error', 'expired'); END IF;
  IF v_appr.signed_at IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'already_signed'); END IF;
  IF _decision NOT IN ('aprovado','recusado') THEN RETURN jsonb_build_object('success', false, 'error','bad_decision'); END IF;
  IF COALESCE(trim(_approver_name),'') = '' THEN RETURN jsonb_build_object('success', false, 'error','missing_name'); END IF;
  IF NOT COALESCE(_ciencia, false) THEN RETURN jsonb_build_object('success', false, 'error','missing_ciencia'); END IF;

  UPDATE public.purchase_order_approvals
     SET decision = _decision, approver_name = _approver_name, approver_cargo = _approver_cargo,
         approver_email = _approver_email, approver_ip = _ip, motivo_recusa = _motivo_recusa,
         ciencia_lgpd = true, signed_at = now()
   WHERE id = v_appr.id;

  IF _decision = 'aprovado' THEN
    UPDATE public.purchase_orders
       SET status = 'autorizada'::purchase_order_status, aprovado_em = now(),
           observacoes = COALESCE(observacoes,'') ||
             E'\n[Assinatura digital via link] ' || _approver_name ||
             COALESCE(' — ' || NULLIF(_approver_cargo,''),'') ||
             ' em ' || to_char(now(),'DD/MM/YYYY HH24:MI')
     WHERE id = v_appr.purchase_order_id;
  ELSE
    UPDATE public.purchase_orders
       SET status = 'negada'::purchase_order_status, motivo_negacao = _motivo_recusa
     WHERE id = v_appr.purchase_order_id;
  END IF;

  INSERT INTO public.purchase_audit_log (entity_type, entity_id, action, changed_by, changed_by_name, motivo)
  VALUES ('purchase_order_approval', v_appr.purchase_order_id,
          CASE WHEN _decision='aprovado' THEN 'signed_approved' ELSE 'signed_rejected' END,
          v_appr.created_by, _approver_name,
          COALESCE(_motivo_recusa, 'Assinatura via link público — IP ' || COALESCE(_ip,'?')));

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_for_approval(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_order_approval(uuid, text, text, text, text, text, text, boolean) TO anon, authenticated;