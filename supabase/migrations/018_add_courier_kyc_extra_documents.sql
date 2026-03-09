-- Add proof of address and selfie with ID to courier_kyc
ALTER TABLE public.courier_kyc
  ADD COLUMN IF NOT EXISTS proof_of_address_url TEXT,
  ADD COLUMN IF NOT EXISTS selfie_with_id_url TEXT;

COMMENT ON COLUMN public.courier_kyc.proof_of_address_url IS 'Storage path for proof of address document';
COMMENT ON COLUMN public.courier_kyc.selfie_with_id_url IS 'Storage path for selfie with ID document';
