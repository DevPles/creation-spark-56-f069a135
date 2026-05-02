DROP POLICY IF EXISTS "Creator admin or gestor can update opme_requests" ON public.opme_requests;

CREATE POLICY "Authenticated can update opme_requests"
ON public.opme_requests
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);