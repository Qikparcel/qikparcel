-- Dispute status change history for audit trail
CREATE TABLE IF NOT EXISTS public.dispute_status_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  dispute_id UUID REFERENCES public.disputes(id) ON DELETE CASCADE NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_status_history_dispute ON public.dispute_status_history(dispute_id);

-- RLS: admins can read all, no one can insert except via service role (API does it)
ALTER TABLE public.dispute_status_history ENABLE ROW LEVEL SECURITY;

-- Allow admins to read dispute history (for their own disputes via join - simplify: allow read for authenticated admins)
CREATE POLICY "Admins can read dispute status history"
  ON public.dispute_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
