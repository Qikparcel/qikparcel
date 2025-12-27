-- Temporary OTP storage table
-- Used to store OTP codes for phone verification
-- OTPs expire after 10 minutes

CREATE TABLE IF NOT EXISTS public.otp_codes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX idx_otp_phone ON public.otp_codes(phone_number);
CREATE INDEX idx_otp_expires ON public.otp_codes(expires_at);

-- Function to clean up expired OTPs
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM public.otp_codes
  WHERE expires_at < NOW() OR used = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access (for API routes)
-- No user access needed - this is backend only


