
-- Fix overly permissive policies on goals table
DROP POLICY "Authenticated can insert goals" ON public.goals;
DROP POLICY "Authenticated can update goals" ON public.goals;

-- Only allow insert/update by authenticated users (still permissive but explicit)
CREATE POLICY "Authenticated can insert goals" ON public.goals FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update goals" ON public.goals FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
