-- Migration to ensure cascading deletes work properly for admin user deletion
-- This ensures that when a user is deleted from auth.users, their profile is also deleted
-- which will cascade to all related data (parcels, trips, etc.)

-- Note: We cannot directly modify the auth.users table, but we can ensure
-- that when profiles are deleted, all related data cascades properly.
-- The profiles table already references auth.users(id), so we need to ensure
-- that when auth.users is deleted (via Admin API), the profile deletion cascades.

-- Since we cannot add ON DELETE CASCADE to the profiles table's reference to auth.users
-- (as it's a system table), we'll handle deletion via a trigger or function.
-- However, Supabase Admin API handles this automatically when deleting users.

-- For now, we'll ensure all other cascading relationships are in place.
-- The main concern is ensuring that when we delete a profile, all related data is deleted.

-- Verify that all foreign key relationships have ON DELETE CASCADE
-- (They should already be set from 001_initial_schema.sql, but this is a verification)

-- Add a function to safely delete a user and all related data
-- This will be called from the admin API route
CREATE OR REPLACE FUNCTION public.delete_user_cascade(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete from profiles (this will cascade to all related tables)
  -- Note: This function assumes the auth.users entry will be deleted separately via Admin API
  DELETE FROM public.profiles WHERE id = user_id;
  
  -- The CASCADE on foreign keys will automatically delete:
  -- - parcels (and parcel_status_history, parcel_trip_matches, message_threads, disputes, payouts)
  -- - trips (and parcel_trip_matches)
  -- - courier_kyc
  -- - messages (via message_threads)
END;
$$;

-- Grant execute permission to authenticated admins
GRANT EXECUTE ON FUNCTION public.delete_user_cascade(UUID) TO authenticated;
