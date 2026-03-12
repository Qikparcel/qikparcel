-- Lock in-app chat until sender payment is completed for accepted match.
-- Applies at DB policy level to prevent bypassing API checks.

DROP POLICY IF EXISTS "Users can view chat threads for their parcels" ON public.chat_threads;
DROP POLICY IF EXISTS "Users can insert chat threads for their parcels" ON public.chat_threads;
DROP POLICY IF EXISTS "Users can view messages in their threads" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert messages in their threads" ON public.chat_messages;

CREATE POLICY "Users can view chat threads for their parcels"
  ON public.chat_threads FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.parcels
      WHERE parcels.id = chat_threads.parcel_id
        AND (
          parcels.sender_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.trips
            WHERE trips.id = parcels.matched_trip_id
              AND trips.courier_id = auth.uid()
          )
        )
        AND EXISTS (
          SELECT 1
          FROM public.parcel_trip_matches
          WHERE parcel_trip_matches.parcel_id = parcels.id
            AND parcel_trip_matches.trip_id = parcels.matched_trip_id
            AND parcel_trip_matches.status = 'accepted'
            AND parcel_trip_matches.payment_status = 'paid'
        )
    )
  );

CREATE POLICY "Users can insert chat threads for their parcels"
  ON public.chat_threads FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.parcels
      WHERE parcels.id = chat_threads.parcel_id
        AND (
          parcels.sender_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.trips
            WHERE trips.id = parcels.matched_trip_id
              AND trips.courier_id = auth.uid()
          )
        )
        AND EXISTS (
          SELECT 1
          FROM public.parcel_trip_matches
          WHERE parcel_trip_matches.parcel_id = parcels.id
            AND parcel_trip_matches.trip_id = parcels.matched_trip_id
            AND parcel_trip_matches.status = 'accepted'
            AND parcel_trip_matches.payment_status = 'paid'
        )
    )
  );

CREATE POLICY "Users can view messages in their threads"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_threads
      JOIN public.parcels ON parcels.id = chat_threads.parcel_id
      WHERE chat_threads.id = chat_messages.thread_id
        AND (
          parcels.sender_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.trips
            WHERE trips.id = parcels.matched_trip_id
              AND trips.courier_id = auth.uid()
          )
        )
        AND EXISTS (
          SELECT 1
          FROM public.parcel_trip_matches
          WHERE parcel_trip_matches.parcel_id = parcels.id
            AND parcel_trip_matches.trip_id = parcels.matched_trip_id
            AND parcel_trip_matches.status = 'accepted'
            AND parcel_trip_matches.payment_status = 'paid'
        )
    )
  );

CREATE POLICY "Users can insert messages in their threads"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1
      FROM public.chat_threads
      JOIN public.parcels ON parcels.id = chat_threads.parcel_id
      WHERE chat_threads.id = chat_messages.thread_id
        AND (
          parcels.sender_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.trips
            WHERE trips.id = parcels.matched_trip_id
              AND trips.courier_id = auth.uid()
          )
        )
        AND EXISTS (
          SELECT 1
          FROM public.parcel_trip_matches
          WHERE parcel_trip_matches.parcel_id = parcels.id
            AND parcel_trip_matches.trip_id = parcels.matched_trip_id
            AND parcel_trip_matches.status = 'accepted'
            AND parcel_trip_matches.payment_status = 'paid'
        )
    )
  );
