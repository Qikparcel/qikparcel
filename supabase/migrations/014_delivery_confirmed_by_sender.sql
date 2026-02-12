-- Sender confirms delivery before courier payout is triggered
ALTER TABLE public.parcel_trip_matches
ADD COLUMN IF NOT EXISTS delivery_confirmed_by_sender_at TIMESTAMPTZ;

COMMENT ON COLUMN public.parcel_trip_matches.delivery_confirmed_by_sender_at IS 'When the sender confirmed delivery; payout is triggered at this time.';
