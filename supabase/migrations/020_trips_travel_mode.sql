-- Add travel mode and reference (flight number, vehicle registration, etc.) to trips
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS travel_mode TEXT CHECK (travel_mode IN ('car', 'airplane', 'train', 'bus', 'other')),
  ADD COLUMN IF NOT EXISTS travel_reference TEXT;

COMMENT ON COLUMN public.trips.travel_mode IS 'Mode of travel: car, airplane, train, bus, other';
COMMENT ON COLUMN public.trips.travel_reference IS 'Flight number (airplane), vehicle registration (car), train/bus number, etc.';
