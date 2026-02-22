-- Track when each user last read each chat thread (for unread badge)
CREATE TABLE IF NOT EXISTS public.chat_thread_reads (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, thread_id)
);

ALTER TABLE public.chat_thread_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own read status"
  ON public.chat_thread_reads FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
