-- Bidding System
-- Adds optional sealed reverse-auction flow on top of existing matching.
-- Parcels in `bidding` mode collect bids from KYC-approved couriers; sender picks winner.
-- On failure (no bids / stale / withdrawal / payment timeout), parcel falls back per fallback_mode,
-- with engaged-but-failed couriers excluded from re-matching on this parcel and accruing strikes.

-- ============================================
-- PARCELS: pricing mode + bidding window
-- ============================================
ALTER TABLE public.parcels
  ADD COLUMN IF NOT EXISTS pricing_mode TEXT NOT NULL DEFAULT 'fixed'
    CHECK (pricing_mode IN ('fixed', 'bidding')),
  ADD COLUMN IF NOT EXISTS bidding_opens_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bidding_closes_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bidding_min_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS bidding_max_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS bidding_estimate_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS bidding_currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS bidding_attempt_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_bidding_attempts INT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS fallback_mode TEXT NOT NULL DEFAULT 'fixed'
    CHECK (fallback_mode IN ('fixed', 'rebid', 'cancel'));

CREATE INDEX IF NOT EXISTS idx_parcels_pricing_mode ON public.parcels(pricing_mode);
CREATE INDEX IF NOT EXISTS idx_parcels_bidding_closes_at ON public.parcels(bidding_closes_at);

-- ============================================
-- PARCEL BIDS
-- ============================================
CREATE TABLE IF NOT EXISTS public.parcel_bids (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  parcel_id UUID NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  courier_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  message TEXT,
  estimated_pickup_at TIMESTAMPTZ,
  estimated_delivery_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'withdrawn', 'accepted', 'rejected', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (parcel_id, courier_id)
);

CREATE INDEX IF NOT EXISTS idx_parcel_bids_parcel ON public.parcel_bids(parcel_id);
CREATE INDEX IF NOT EXISTS idx_parcel_bids_courier ON public.parcel_bids(courier_id);
CREATE INDEX IF NOT EXISTS idx_parcel_bids_status ON public.parcel_bids(status);

CREATE TRIGGER update_parcel_bids_updated_at
  BEFORE UPDATE ON public.parcel_bids
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PARCEL COURIER EXCLUSIONS
-- Soft (per-parcel) blocklist applied by matching finder.
-- ============================================
CREATE TABLE IF NOT EXISTS public.parcel_courier_exclusions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  parcel_id UUID NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  courier_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN (
    'bid_won_withdrew',
    'bid_won_payment_timeout',
    'rejected_by_sender',
    'manual_block'
  )),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (parcel_id, courier_id)
);

CREATE INDEX IF NOT EXISTS idx_parcel_courier_exclusions_parcel
  ON public.parcel_courier_exclusions(parcel_id);
CREATE INDEX IF NOT EXISTS idx_parcel_courier_exclusions_courier
  ON public.parcel_courier_exclusions(courier_id);

-- ============================================
-- COURIER STRIKES
-- Account-level strike system. Three strikes in 30 days suspends bidding privileges.
-- ============================================
CREATE TABLE IF NOT EXISTS public.courier_strikes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  courier_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parcel_id UUID REFERENCES public.parcels(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  cleared_at TIMESTAMPTZ,
  cleared_by UUID REFERENCES public.profiles(id),
  cleared_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courier_strikes_courier
  ON public.courier_strikes(courier_id);
CREATE INDEX IF NOT EXISTS idx_courier_strikes_active
  ON public.courier_strikes(courier_id, created_at)
  WHERE cleared_at IS NULL;

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.parcel_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcel_courier_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_strikes ENABLE ROW LEVEL SECURITY;

-- Couriers can read their own bids
CREATE POLICY "Couriers can view own bids"
  ON public.parcel_bids FOR SELECT
  USING (auth.uid() = courier_id);

-- Senders can read bids on their parcels
CREATE POLICY "Senders can view bids on own parcels"
  ON public.parcel_bids FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.parcels
      WHERE parcels.id = parcel_bids.parcel_id
        AND parcels.sender_id = auth.uid()
    )
  );

-- Admins can read all bids
CREATE POLICY "Admins can view all bids"
  ON public.parcel_bids FOR SELECT
  USING (public.is_admin(auth.uid()));

           -- Couriers can submit/update/withdraw their own bid (writes are also gated by API logic)
           CREATE POLICY "Couriers can insert own bid"
             ON public.parcel_bids FOR INSERT
             WITH CHECK (
               auth.uid() = courier_id
               AND EXISTS (
                 SELECT 1 FROM public.profiles
                 WHERE id = auth.uid() AND role = 'courier'
               )
             );

CREATE POLICY "Couriers can update own bid"
  ON public.parcel_bids FOR UPDATE
  USING (auth.uid() = courier_id)
  WITH CHECK (auth.uid() = courier_id);

-- Exclusions: senders see their own parcel exclusions; admins see all
CREATE POLICY "Senders can view own parcel exclusions"
  ON public.parcel_courier_exclusions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.parcels
      WHERE parcels.id = parcel_courier_exclusions.parcel_id
        AND parcels.sender_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all exclusions"
  ON public.parcel_courier_exclusions FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Couriers can see exclusions that apply to them (informational)
CREATE POLICY "Couriers can view own exclusions"
  ON public.parcel_courier_exclusions FOR SELECT
  USING (auth.uid() = courier_id);

-- Strikes: courier can see their own strikes; admin can see all
CREATE POLICY "Couriers can view own strikes"
  ON public.courier_strikes FOR SELECT
  USING (auth.uid() = courier_id);

CREATE POLICY "Admins can view all strikes"
  ON public.courier_strikes FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage strikes"
  ON public.courier_strikes FOR ALL
  USING (public.is_admin(auth.uid()));

-- Server inserts to exclusions/strikes use the service role and bypass RLS.

-- ============================================
-- HELPER: count active strikes in last N days
-- ============================================
CREATE OR REPLACE FUNCTION public.active_courier_strike_count(
  p_courier_id UUID,
  p_within_days INT DEFAULT 30
)
RETURNS INT AS $$
  SELECT COUNT(*)::INT
  FROM public.courier_strikes
  WHERE courier_id = p_courier_id
    AND cleared_at IS NULL
    AND created_at >= NOW() - (p_within_days || ' days')::INTERVAL;
$$ LANGUAGE sql SECURITY DEFINER;
