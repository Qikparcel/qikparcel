-- QikParcel MVP - Basic RLS Policies
-- This migration adds basic RLS policies for all tables
-- Run this after enabling RLS on tables

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Users can read their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile (on signup)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- PARCELS POLICIES
-- ============================================

-- Senders can view their own parcels
DROP POLICY IF EXISTS "Senders can view own parcels" ON public.parcels;
CREATE POLICY "Senders can view own parcels"
  ON public.parcels FOR SELECT
  USING (auth.uid() = sender_id);

-- Senders can create parcels
DROP POLICY IF EXISTS "Senders can create parcels" ON public.parcels;
CREATE POLICY "Senders can create parcels"
  ON public.parcels FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Senders can update their own parcels
DROP POLICY IF EXISTS "Senders can update own parcels" ON public.parcels;
CREATE POLICY "Senders can update own parcels"
  ON public.parcels FOR UPDATE
  USING (auth.uid() = sender_id);

-- ============================================
-- TRIPS POLICIES
-- ============================================

-- Couriers can view their own trips
DROP POLICY IF EXISTS "Couriers can view own trips" ON public.trips;
CREATE POLICY "Couriers can view own trips"
  ON public.trips FOR SELECT
  USING (auth.uid() = courier_id);

-- Couriers can create trips
DROP POLICY IF EXISTS "Couriers can create trips" ON public.trips;
CREATE POLICY "Couriers can create trips"
  ON public.trips FOR INSERT
  WITH CHECK (auth.uid() = courier_id);

-- Couriers can update their own trips
DROP POLICY IF EXISTS "Couriers can update own trips" ON public.trips;
CREATE POLICY "Couriers can update own trips"
  ON public.trips FOR UPDATE
  USING (auth.uid() = courier_id);

-- ============================================
-- COURIER KYC POLICIES
-- ============================================

-- Couriers can view their own KYC
DROP POLICY IF EXISTS "Couriers can view own KYC" ON public.courier_kyc;
CREATE POLICY "Couriers can view own KYC"
  ON public.courier_kyc FOR SELECT
  USING (auth.uid() = courier_id);

-- Couriers can insert/update their own KYC
DROP POLICY IF EXISTS "Couriers can manage own KYC" ON public.courier_kyc;
CREATE POLICY "Couriers can manage own KYC"
  ON public.courier_kyc FOR ALL
  USING (auth.uid() = courier_id)
  WITH CHECK (auth.uid() = courier_id);

-- ============================================
-- PARCEL STATUS HISTORY POLICIES
-- ============================================

-- Users can view status history for their parcels
DROP POLICY IF EXISTS "Users can view own parcel status history" ON public.parcel_status_history;
CREATE POLICY "Users can view own parcel status history"
  ON public.parcel_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.parcels
      WHERE parcels.id = parcel_status_history.parcel_id
      AND parcels.sender_id = auth.uid()
    )
  );

-- ============================================
-- PARCEL TRIP MATCHES POLICIES
-- ============================================

-- Users can view matches for their parcels/trips
DROP POLICY IF EXISTS "Users can view relevant matches" ON public.parcel_trip_matches;
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

-- ============================================
-- MESSAGE THREADS POLICIES
-- ============================================

-- Users can view threads for their parcels
DROP POLICY IF EXISTS "Users can view own message threads" ON public.message_threads;
CREATE POLICY "Users can view own message threads"
  ON public.message_threads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.parcels
      WHERE parcels.id = message_threads.parcel_id
      AND parcels.sender_id = auth.uid()
    )
  );

-- ============================================
-- MESSAGES POLICIES
-- ============================================

-- Users can view messages in their threads
DROP POLICY IF EXISTS "Users can view messages in own threads" ON public.messages;
CREATE POLICY "Users can view messages in own threads"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.message_threads
      WHERE message_threads.id = messages.thread_id
      AND EXISTS (
        SELECT 1 FROM public.parcels
        WHERE parcels.id = message_threads.parcel_id
        AND parcels.sender_id = auth.uid()
      )
    )
  );

-- ============================================
-- DISPUTES POLICIES
-- ============================================

-- Users can view disputes for their parcels
DROP POLICY IF EXISTS "Users can view own disputes" ON public.disputes;
CREATE POLICY "Users can view own disputes"
  ON public.disputes FOR SELECT
  USING (
    raised_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.parcels
      WHERE parcels.id = disputes.parcel_id
      AND parcels.sender_id = auth.uid()
    )
  );

-- Users can create disputes for their parcels
DROP POLICY IF EXISTS "Users can create disputes" ON public.disputes;
CREATE POLICY "Users can create disputes"
  ON public.disputes FOR INSERT
  WITH CHECK (
    raised_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.parcels
      WHERE parcels.id = disputes.parcel_id
      AND parcels.sender_id = auth.uid()
    )
  );

-- ============================================
-- PAYOUTS POLICIES
-- ============================================

-- Couriers can view their own payouts
DROP POLICY IF EXISTS "Couriers can view own payouts" ON public.payouts;
CREATE POLICY "Couriers can view own payouts"
  ON public.payouts FOR SELECT
  USING (auth.uid() = courier_id);

-- ============================================
-- OTP_CODES POLICIES
-- ============================================

-- OTP codes are only accessible via service role (backend only)
-- No user policies needed - API routes use service role key
-- RLS is enabled but no policies = service role only access
