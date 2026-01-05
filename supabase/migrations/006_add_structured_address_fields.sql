-- Add structured address fields to profiles table
-- Replaces the simple 'address' TEXT field with structured fields for better delivery logistics

-- Add new structured address columns
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS street_address TEXT,
ADD COLUMN IF NOT EXISTS address_line_2 TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS postcode TEXT,
ADD COLUMN IF NOT EXISTS country TEXT;

-- Create index for location-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_country ON public.profiles(country);
CREATE INDEX IF NOT EXISTS idx_profiles_postcode ON public.profiles(postcode);

-- Note: The old 'address' column is kept for backward compatibility
-- You can migrate existing data if needed, or drop it later:
-- UPDATE public.profiles SET street_address = address WHERE address IS NOT NULL AND street_address IS NULL;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS address;



