-- Ratings and reviews for deliveries (sender rates courier, courier rates sender)
CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  parcel_id UUID REFERENCES public.parcels(id) ON DELETE CASCADE NOT NULL,
  match_id UUID REFERENCES public.parcel_trip_matches(id) ON DELETE CASCADE NOT NULL,
  rater_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rated_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parcel_id, rater_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_parcel ON public.ratings(parcel_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rated ON public.ratings(rated_id);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- Users can view ratings for parcels they have access to, and ratings they gave
CREATE POLICY "Users can view ratings for own parcels or given"
  ON public.ratings FOR SELECT
  USING (
    auth.uid() = rater_id
    OR auth.uid() = rated_id
    OR EXISTS (
      SELECT 1 FROM public.parcels
      WHERE parcels.id = ratings.parcel_id
      AND (parcels.sender_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.trips
        WHERE trips.id = parcels.matched_trip_id AND trips.courier_id = auth.uid()
      ))
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Users can insert ratings for parcels they were involved in (sender or courier)
CREATE POLICY "Users can create ratings for own deliveries"
  ON public.ratings FOR INSERT
  WITH CHECK (
    auth.uid() = rater_id
    AND (
      EXISTS (
        SELECT 1 FROM public.parcels
        WHERE parcels.id = ratings.parcel_id AND parcels.sender_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.parcels p
        JOIN public.trips t ON t.id = p.matched_trip_id
        WHERE p.id = ratings.parcel_id AND t.courier_id = auth.uid()
      )
    )
  );

COMMENT ON TABLE public.ratings IS 'Reviews/ratings from sender to courier or courier to sender after delivery';
