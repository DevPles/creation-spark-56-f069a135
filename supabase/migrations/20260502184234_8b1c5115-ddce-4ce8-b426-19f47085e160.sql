DROP POLICY IF EXISTS "Creator admin or gestor can view opme_requests" ON public.opme_requests;
DROP POLICY IF EXISTS "Authenticated can view opme_requests" ON public.opme_requests;

CREATE POLICY "Authenticated can view opme_requests"
ON public.opme_requests
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Creator admin or gestor can update opme_requests" ON public.opme_requests;
DROP POLICY IF EXISTS "Authenticated can update opme_requests" ON public.opme_requests;

CREATE POLICY "Authenticated can update opme_requests"
ON public.opme_requests
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);