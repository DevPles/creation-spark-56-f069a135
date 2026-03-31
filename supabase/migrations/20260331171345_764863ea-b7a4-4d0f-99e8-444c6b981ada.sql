
-- Create storage bucket for contract PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('contract-pdfs', 'contract-pdfs', true);

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload contract PDFs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'contract-pdfs');

-- Allow authenticated users to view files
CREATE POLICY "Authenticated users can view contract PDFs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'contract-pdfs');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete contract PDFs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'contract-pdfs');
