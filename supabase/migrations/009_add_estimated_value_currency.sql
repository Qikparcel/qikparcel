-- Add currency column to parcels table for estimated value
ALTER TABLE public.parcels
ADD COLUMN IF NOT EXISTS estimated_value_currency TEXT CHECK (estimated_value_currency IN ('USD', 'EUR', 'GBP'));

-- Add comment
COMMENT ON COLUMN public.parcels.estimated_value_currency IS 'Currency code for estimated_value (USD, EUR, or GBP)';

