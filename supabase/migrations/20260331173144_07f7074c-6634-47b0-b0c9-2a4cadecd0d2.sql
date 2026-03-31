
INSERT INTO storage.buckets (id, name, public) VALUES ('training-videos', 'training-videos', true);

CREATE POLICY "Anyone can view training videos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'training-videos');
CREATE POLICY "Admins can upload training videos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'training-videos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete training videos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'training-videos' AND public.has_role(auth.uid(), 'admin'));
