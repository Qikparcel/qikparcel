-- ============================================
-- STORAGE BUCKET POLICIES FOR COURIER DOCUMENTS
-- ============================================
-- 
-- IMPORTANT: You must create the storage bucket manually first!
-- 
-- Steps to set up:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Click "Create a new bucket"
-- 3. Name: courier-documents (must be exact, lowercase)
-- 4. Set to PRIVATE (do NOT check "Public bucket")
-- 5. Click "Create bucket"
-- 6. Then run this SQL in SQL Editor
--
-- For detailed step-by-step instructions, see: SETUP_STORAGE_BUCKET.md
-- ============================================

-- Storage policies (run these AFTER creating the bucket)
-- These policies allow couriers to upload their own documents and admins to view all

-- Allow couriers to upload their own documents
CREATE POLICY "Couriers can upload own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'courier-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow couriers to read their own documents
CREATE POLICY "Couriers can read own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'courier-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow admins to read all documents
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

-- Allow couriers to update their own documents
CREATE POLICY "Couriers can update own documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'courier-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow couriers to delete their own documents
CREATE POLICY "Couriers can delete own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'courier-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
