-- In-app chat: chat_threads (one per parcel with accepted match) + chat_messages
-- Realtime subscription on chat_messages for live updates

-- Thread: one per parcel (created when parcel has accepted match)
CREATE TABLE IF NOT EXISTS public.chat_threads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  parcel_id UUID NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parcel_id)
);

-- Messages: text only for MVP
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_parcel ON public.chat_threads(parcel_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON public.chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(created_at);

-- Enable RLS
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS: sender or courier of parcel can view and insert
CREATE POLICY "Users can view chat threads for their parcels"
  ON public.chat_threads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.parcels
      WHERE parcels.id = chat_threads.parcel_id
      AND (
        parcels.sender_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.trips
          WHERE trips.id = parcels.matched_trip_id
          AND trips.courier_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can insert chat threads for their parcels"
  ON public.chat_threads FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.parcels
      WHERE parcels.id = chat_threads.parcel_id
      AND (
        parcels.sender_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.trips
          WHERE trips.id = parcels.matched_trip_id
          AND trips.courier_id = auth.uid()
        )
      )
    )
  );

-- RLS: messages - view/insert if user can access thread
CREATE POLICY "Users can view messages in their threads"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_threads
      JOIN public.parcels ON parcels.id = chat_threads.parcel_id
      WHERE chat_threads.id = chat_messages.thread_id
      AND (
        parcels.sender_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.trips
          WHERE trips.id = parcels.matched_trip_id
          AND trips.courier_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can insert messages in their threads"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.chat_threads
      JOIN public.parcels ON parcels.id = chat_threads.parcel_id
      WHERE chat_threads.id = chat_messages.thread_id
      AND (
        parcels.sender_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.trips
          WHERE trips.id = parcels.matched_trip_id
          AND trips.courier_id = auth.uid()
        )
      )
    )
  );

-- Admins
CREATE POLICY "Admins can view all chat threads"
  ON public.chat_threads FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view all chat messages"
  ON public.chat_messages FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Enable Realtime for chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
