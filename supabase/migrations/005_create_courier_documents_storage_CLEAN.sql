-- Storage Bucket Policies for Courier Documents
-- Run this AFTER creating the bucket named 'courier-documents' in Storage

CREATE POLICY "Couriers can upload own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'courier-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Couriers can read own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'courier-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can read all documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'courier-documents' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Couriers can update own documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'courier-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Couriers can delete own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'courier-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

