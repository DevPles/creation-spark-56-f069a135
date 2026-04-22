-- Helper: verifica se o usuário pode editar uma requisição (criador, admin ou gestor)
CREATE OR REPLACE FUNCTION public.can_edit_requisition(_req_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.purchase_requisitions r
    WHERE r.id = _req_id
      AND (r.created_by = auth.uid()
           OR public.has_role(auth.uid(), 'admin'::app_role)
           OR public.has_role(auth.uid(), 'gestor'::app_role))
  )
$$;

CREATE OR REPLACE FUNCTION public.can_edit_quotation(_q_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.purchase_quotations q
    WHERE q.id = _q_id
      AND (q.created_by = auth.uid()
           OR public.has_role(auth.uid(), 'admin'::app_role)
           OR public.has_role(auth.uid(), 'gestor'::app_role))
  )
$$;

CREATE OR REPLACE FUNCTION public.can_edit_order(_o_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.purchase_orders o
    WHERE o.id = _o_id
      AND (o.created_by = auth.uid()
           OR public.has_role(auth.uid(), 'admin'::app_role)
           OR public.has_role(auth.uid(), 'gestor'::app_role))
  )
$$;

-- =====================================================
-- purchase_requisition_items
-- =====================================================
DROP POLICY IF EXISTS "insert req items" ON public.purchase_requisition_items;
DROP POLICY IF EXISTS "update req items" ON public.purchase_requisition_items;
DROP POLICY IF EXISTS "delete req items" ON public.purchase_requisition_items;

CREATE POLICY "insert req items" ON public.purchase_requisition_items
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_requisition(requisition_id));

CREATE POLICY "update req items" ON public.purchase_requisition_items
  FOR UPDATE TO authenticated
  USING (public.can_edit_requisition(requisition_id));

CREATE POLICY "delete req items" ON public.purchase_requisition_items
  FOR DELETE TO authenticated
  USING (public.can_edit_requisition(requisition_id));

-- =====================================================
-- purchase_order_items
-- =====================================================
DROP POLICY IF EXISTS "insert order items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "update order items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "delete order items" ON public.purchase_order_items;

CREATE POLICY "insert order items" ON public.purchase_order_items
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_order(purchase_order_id));

CREATE POLICY "update order items" ON public.purchase_order_items
  FOR UPDATE TO authenticated
  USING (public.can_edit_order(purchase_order_id));

CREATE POLICY "delete order items" ON public.purchase_order_items
  FOR DELETE TO authenticated
  USING (public.can_edit_order(purchase_order_id));

-- =====================================================
-- purchase_quotation_suppliers
-- =====================================================
DROP POLICY IF EXISTS "insert qsup" ON public.purchase_quotation_suppliers;
DROP POLICY IF EXISTS "update qsup" ON public.purchase_quotation_suppliers;
DROP POLICY IF EXISTS "delete qsup" ON public.purchase_quotation_suppliers;

CREATE POLICY "insert qsup" ON public.purchase_quotation_suppliers
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_quotation(quotation_id));

CREATE POLICY "update qsup" ON public.purchase_quotation_suppliers
  FOR UPDATE TO authenticated
  USING (public.can_edit_quotation(quotation_id));

CREATE POLICY "delete qsup" ON public.purchase_quotation_suppliers
  FOR DELETE TO authenticated
  USING (public.can_edit_quotation(quotation_id));

-- =====================================================
-- purchase_quotation_prices
-- =====================================================
DROP POLICY IF EXISTS "insert qprices" ON public.purchase_quotation_prices;
DROP POLICY IF EXISTS "update qprices" ON public.purchase_quotation_prices;
DROP POLICY IF EXISTS "delete qprices" ON public.purchase_quotation_prices;

CREATE POLICY "insert qprices" ON public.purchase_quotation_prices
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_quotation(quotation_id));

CREATE POLICY "update qprices" ON public.purchase_quotation_prices
  FOR UPDATE TO authenticated
  USING (public.can_edit_quotation(quotation_id));

CREATE POLICY "delete qprices" ON public.purchase_quotation_prices
  FOR DELETE TO authenticated
  USING (public.can_edit_quotation(quotation_id));