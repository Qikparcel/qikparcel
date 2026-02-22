-- Restore "Couriers can view matched parcels" policy (removed in 008)
-- Needed for: chat thread/message RLS subqueries, Realtime delivery to couriers
CREATE POLICY "Couriers can view matched parcels"
  ON public.parcels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = parcels.matched_trip_id
      AND trips.courier_id = auth.uid()
    )
  );
