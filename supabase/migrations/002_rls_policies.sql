-- QikParcel MVP - Row Level Security (RLS) Policies
-- This migration sets up security policies for all tables

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcel_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcel_trip_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_kyc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if user is courier
CREATE OR REPLACE FUNCTION public.is_courier(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'courier'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if user is sender
CREATE OR REPLACE FUNCTION public.is_sender(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'sender'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile (on signup)
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ============================================
-- PARCELS POLICIES
-- ============================================

-- Senders can view their own parcels
CREATE POLICY "Senders can view own parcels"
  ON public.parcels FOR SELECT
  USING (auth.uid() = sender_id);

-- Senders can create parcels
CREATE POLICY "Senders can create parcels"
  ON public.parcels FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND public.is_sender(auth.uid()));

-- Senders can update their own parcels (when pending)
CREATE POLICY "Senders can update own pending parcels"
  ON public.parcels FOR UPDATE
  USING (auth.uid() = sender_id AND status = 'pending');

-- Couriers can view parcels matched to their trips
CREATE POLICY "Couriers can view matched parcels"
  ON public.parcels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = parcels.matched_trip_id
      AND trips.courier_id = auth.uid()
    )
  );

-- Admins can view all parcels
CREATE POLICY "Admins can view all parcels"
  ON public.parcels FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Admins can update all parcels
CREATE POLICY "Admins can update all parcels"
  ON public.parcels FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- ============================================
-- PARCEL STATUS HISTORY POLICIES
-- ============================================

-- Users can view status history for their parcels
CREATE POLICY "Users can view own parcel status history"
  ON public.parcel_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.parcels
      WHERE parcels.id = parcel_status_history.parcel_id
      AND (parcels.sender_id = auth.uid() OR 
           EXISTS (
             SELECT 1 FROM public.trips
             WHERE trips.id = parcels.matched_trip_id
             AND trips.courier_id = auth.uid()
           ))
    )
  );

-- Admins can view all status history
CREATE POLICY "Admins can view all status history"
  ON public.parcel_status_history FOR SELECT
  USING (public.is_admin(auth.uid()));

-- System can insert status history (via service role)
-- This will be handled by service role key, no policy needed

-- ============================================
-- TRIPS POLICIES
-- ============================================

-- Couriers can view their own trips
CREATE POLICY "Couriers can view own trips"
  ON public.trips FOR SELECT
  USING (auth.uid() = courier_id);

-- Couriers can create trips
CREATE POLICY "Couriers can create trips"
  ON public.trips FOR INSERT
  WITH CHECK (auth.uid() = courier_id AND public.is_courier(auth.uid()));

-- Couriers can update their own trips
CREATE POLICY "Couriers can update own trips"
  ON public.trips FOR UPDATE
  USING (auth.uid() = courier_id);

-- Senders can view trips (for matching)
CREATE POLICY "Senders can view available trips"
  ON public.trips FOR SELECT
  USING (status IN ('scheduled', 'in_progress'));

-- Admins can view all trips
CREATE POLICY "Admins can view all trips"
  ON public.trips FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ============================================
-- PARCEL TRIP MATCHES POLICIES
-- ============================================

-- Users can view matches for their parcels/trips
CREATE POLICY "Users can view relevant matches"
  ON public.parcel_trip_matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.parcels
      WHERE parcels.id = parcel_trip_matches.parcel_id
      AND parcels.sender_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = parcel_trip_matches.trip_id
      AND trips.courier_id = auth.uid()
    )
  );

-- Admins can view all matches
CREATE POLICY "Admins can view all matches"
  ON public.parcel_trip_matches FOR SELECT
  USING (public.is_admin(auth.uid()));

-- System can insert/update matches (via service role)
-- This will be handled by service role key

-- ============================================
-- MESSAGE THREADS POLICIES
-- ============================================

-- Users can view threads for their parcels
CREATE POLICY "Users can view own message threads"
  ON public.message_threads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.parcels
      WHERE parcels.id = message_threads.parcel_id
      AND (parcels.sender_id = auth.uid() OR 
           EXISTS (
             SELECT 1 FROM public.trips
             WHERE trips.id = parcels.matched_trip_id
             AND trips.courier_id = auth.uid()
           ))
    )
  );

-- System can create threads (via service role)
-- Users can create threads for their parcels
CREATE POLICY "Users can create threads for own parcels"
  ON public.message_threads FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.parcels
      WHERE parcels.id = message_threads.parcel_id
      AND parcels.sender_id = auth.uid()
    )
  );

-- Admins can view all threads
CREATE POLICY "Admins can view all threads"
  ON public.message_threads FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ============================================
-- MESSAGES POLICIES
-- ============================================

-- Users can view messages in their threads
CREATE POLICY "Users can view messages in own threads"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.message_threads
      WHERE message_threads.id = messages.thread_id
      AND EXISTS (
        SELECT 1 FROM public.parcels
        WHERE parcels.id = message_threads.parcel_id
        AND (parcels.sender_id = auth.uid() OR 
             EXISTS (
               SELECT 1 FROM public.trips
               WHERE trips.id = parcels.matched_trip_id
               AND trips.courier_id = auth.uid()
             ))
      )
    )
  );

-- System can insert messages (via service role for WhatsApp webhook)
-- This will be handled by service role key

-- Admins can view all messages
CREATE POLICY "Admins can view all messages"
  ON public.messages FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ============================================
-- COURIER KYC POLICIES
-- ============================================

-- Couriers can view their own KYC
CREATE POLICY "Couriers can view own KYC"
  ON public.courier_kyc FOR SELECT
  USING (auth.uid() = courier_id);

-- Couriers can insert/update their own KYC
CREATE POLICY "Couriers can manage own KYC"
  ON public.courier_kyc FOR ALL
  USING (auth.uid() = courier_id)
  WITH CHECK (auth.uid() = courier_id);

-- Admins can view all KYC
CREATE POLICY "Admins can view all KYC"
  ON public.courier_kyc FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Admins can update KYC verification status
CREATE POLICY "Admins can update KYC status"
  ON public.courier_kyc FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- ============================================
-- DISPUTES POLICIES
-- ============================================

-- Users can view disputes for their parcels
CREATE POLICY "Users can view own disputes"
  ON public.disputes FOR SELECT
  USING (
    raised_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.parcels
      WHERE parcels.id = disputes.parcel_id
      AND (parcels.sender_id = auth.uid() OR 
           EXISTS (
             SELECT 1 FROM public.trips
             WHERE trips.id = parcels.matched_trip_id
             AND trips.courier_id = auth.uid()
           ))
    )
  );

-- Users can create disputes for their parcels
CREATE POLICY "Users can create disputes"
  ON public.disputes FOR INSERT
  WITH CHECK (
    raised_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.parcels
      WHERE parcels.id = disputes.parcel_id
      AND (parcels.sender_id = auth.uid() OR 
           EXISTS (
             SELECT 1 FROM public.trips
             WHERE trips.id = parcels.matched_trip_id
             AND trips.courier_id = auth.uid()
           ))
    )
  );

-- Admins can view and update all disputes
CREATE POLICY "Admins can manage all disputes"
  ON public.disputes FOR ALL
  USING (public.is_admin(auth.uid()));

-- ============================================
-- PAYOUTS POLICIES
-- ============================================

-- Couriers can view their own payouts
CREATE POLICY "Couriers can view own payouts"
  ON public.payouts FOR SELECT
  USING (auth.uid() = courier_id);

-- Admins can view and manage all payouts
CREATE POLICY "Admins can manage all payouts"
  ON public.payouts FOR ALL
  USING (public.is_admin(auth.uid()));



