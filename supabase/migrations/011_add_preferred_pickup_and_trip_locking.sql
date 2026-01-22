-- Add preferred pickup time to parcels
ALTER TABLE public.parcels
ADD COLUMN preferred_pickup_time TIMESTAMPTZ;

-- Add locked_parcel_id to trips (one parcel per trip)
ALTER TABLE public.trips
ADD COLUMN locked_parcel_id UUID REFERENCES public.parcels(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_trips_locked_parcel ON public.trips(locked_parcel_id);
CREATE INDEX idx_parcels_preferred_pickup ON public.parcels(preferred_pickup_time);
