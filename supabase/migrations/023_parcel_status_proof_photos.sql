-- Courier pickup/delivery proof photos (admin-only visibility)

ALTER TABLE public.parcel_status_history
ADD COLUMN IF NOT EXISTS proof_photo_path TEXT,
ADD COLUMN IF NOT EXISTS proof_photo_uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Private bucket for courier proof photos.
-- Uploaded/read through server routes using service role.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'parcel-proof-photos',
  'parcel-proof-photos',
  false,
  8388608,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;
