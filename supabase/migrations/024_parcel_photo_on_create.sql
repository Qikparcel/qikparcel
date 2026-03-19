-- Optional parcel photo uploaded during parcel creation

ALTER TABLE public.parcels
ADD COLUMN IF NOT EXISTS parcel_photo_path TEXT;

-- Private bucket for parcel photos.
-- Access is mediated via server routes (signed URLs).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'parcel-photos',
  'parcel-photos',
  false,
  8388608,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;
