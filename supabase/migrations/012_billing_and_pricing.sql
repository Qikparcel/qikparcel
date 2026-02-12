-- Billing & Pricing - Stripe integration and delivery pricing
-- Supports domestic (km-based) and international (country-pair) pricing

-- ============================================
-- PARCELS: Add country fields for pricing
-- ============================================
ALTER TABLE public.parcels
ADD COLUMN IF NOT EXISTS pickup_country TEXT,
ADD COLUMN IF NOT EXISTS delivery_country TEXT;

CREATE INDEX IF NOT EXISTS idx_parcels_pickup_country ON public.parcels(pickup_country);
CREATE INDEX IF NOT EXISTS idx_parcels_delivery_country ON public.parcels(delivery_country);

-- ============================================
-- TRIPS: Add country fields for pricing
-- ============================================
ALTER TABLE public.trips
ADD COLUMN IF NOT EXISTS origin_country TEXT,
ADD COLUMN IF NOT EXISTS destination_country TEXT;

CREATE INDEX IF NOT EXISTS idx_trips_origin_country ON public.trips(origin_country);
CREATE INDEX IF NOT EXISTS idx_trips_destination_country ON public.trips(destination_country);

-- ============================================
-- DELIVERY PRICING: Country-pair and domestic rates
-- ============================================
CREATE TABLE IF NOT EXISTS public.delivery_pricing (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  origin_country TEXT NOT NULL,
  destination_country TEXT NOT NULL,
  base_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  rate_per_km DECIMAL(6, 4) NOT NULL DEFAULT 0,
  max_distance_km INT,  -- Cap for distance component (null = no cap)
  currency TEXT NOT NULL DEFAULT 'USD',
  is_domestic BOOLEAN NOT NULL DEFAULT false,  -- same country
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(origin_country, destination_country)
);

CREATE INDEX IF NOT EXISTS idx_delivery_pricing_origin ON public.delivery_pricing(origin_country);
CREATE INDEX IF NOT EXISTS idx_delivery_pricing_dest ON public.delivery_pricing(destination_country);

-- Trigger for updated_at
CREATE TRIGGER update_delivery_pricing_updated_at
  BEFORE UPDATE ON public.delivery_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default pricing: domestic (ZW, ZA) and sample international pairs
INSERT INTO public.delivery_pricing (origin_country, destination_country, base_fee, rate_per_km, max_distance_km, currency, is_domestic)
VALUES
  -- Domestic Zimbabwe
  ('ZW', 'ZW', 5.00, 0.40, NULL, 'USD', true),
  -- Domestic South Africa
  ('ZA', 'ZA', 5.00, 0.35, NULL, 'USD', true),
  -- Domestic UK
  ('GB', 'GB', 8.00, 0.50, NULL, 'USD', true),
  -- International: ZW <-> ZA
  ('ZW', 'ZA', 25.00, 0.10, 500, 'USD', false),
  ('ZA', 'ZW', 25.00, 0.10, 500, 'USD', false),
  -- International: ZW <-> UK
  ('ZW', 'GB', 80.00, 0.05, 1000, 'USD', false),
  ('GB', 'ZW', 80.00, 0.05, 1000, 'USD', false),
  -- International: ZA <-> UK
  ('ZA', 'GB', 70.00, 0.05, 1000, 'USD', false),
  ('GB', 'ZA', 70.00, 0.05, 1000, 'USD', false),
  -- Fallback: same country (generic domestic)
  ('*', '*', 5.00, 0.40, NULL, 'USD', true)
ON CONFLICT (origin_country, destination_country) DO NOTHING;

-- ============================================
-- PARCEL_TRIP_MATCHES: Add pricing and payment fields
-- ============================================
ALTER TABLE public.parcel_trip_matches
ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed'));

CREATE INDEX IF NOT EXISTS idx_matches_payment_intent ON public.parcel_trip_matches(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_matches_payment_status ON public.parcel_trip_matches(payment_status);

-- ============================================
-- PROFILES: Stripe Connect for couriers
-- ============================================
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_account_onboarded BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_account ON public.profiles(stripe_account_id);

-- ============================================
-- PAYOUTS: Stripe transfer reference
-- ============================================
ALTER TABLE public.payouts
ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_payouts_stripe_transfer ON public.payouts(stripe_transfer_id);
