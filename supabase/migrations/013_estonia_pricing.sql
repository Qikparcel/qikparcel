-- Add Estonia domestic pricing (lower rate for EU-style domestic)
-- Tallinn–Tartu ~185 km: base 5 + 185*0.15 = 32.75, + 15% platform ≈ 38 USD
INSERT INTO public.delivery_pricing (origin_country, destination_country, base_fee, rate_per_km, max_distance_km, currency, is_domestic)
VALUES ('EE', 'EE', 5.00, 0.15, NULL, 'USD', true)
ON CONFLICT (origin_country, destination_country) DO UPDATE SET
  base_fee = EXCLUDED.base_fee,
  rate_per_km = EXCLUDED.rate_per_km,
  updated_at = NOW();
