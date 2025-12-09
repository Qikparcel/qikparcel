# Supabase Database Setup Guide

This guide will help you set up the Supabase database for QikParcel MVP.

## Prerequisites

- Supabase project created (see `CLIENT_ACCOUNT_REQUIREMENTS.md`)
- Access to Supabase dashboard
- Environment variables configured

## Quick Setup (Recommended)

### Step 1: Access Supabase SQL Editor

1. Log in to [Supabase Dashboard](https://app.supabase.com)
2. Select your QikParcel project
3. Navigate to **SQL Editor** in the left sidebar

### Step 2: Run Initial Schema Migration

1. Click **New Query**
2. Open `supabase/migrations/001_initial_schema.sql` from this project
3. Copy the entire contents
4. Paste into the SQL Editor
5. Click **Run** (or press Cmd/Ctrl + Enter)
6. Wait for "Success. No rows returned" message

### Step 3: Run RLS Policies Migration

1. Create a new query in SQL Editor
2. Open `supabase/migrations/002_rls_policies.sql` from this project
3. Copy the entire contents
4. Paste into the SQL Editor
5. Click **Run**
6. Wait for "Success. No rows returned" message

### Step 4: Verify Setup

Run this query in SQL Editor to verify all tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

You should see these tables:
- courier_kyc
- disputes
- message_threads
- messages
- parcel_status_history
- parcel_trip_matches
- parcels
- payouts
- profiles
- trips

### Step 5: Verify RLS is Enabled

Run this query:

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'profiles', 'parcels', 'trips', 'parcel_trip_matches',
    'message_threads', 'messages', 'courier_kyc', 'disputes', 'payouts'
  )
ORDER BY tablename;
```

All tables should have `rowsecurity = true`.

## Create Admin User (Optional)

After setting up authentication, you may want to create an admin user:

1. Go to **Authentication** > **Users** in Supabase dashboard
2. Create a user or use existing user
3. Go to **Table Editor** > **profiles**
4. Insert a new row with:
   - `id`: The user's UUID from auth.users
   - `phone_number`: Admin's phone number
   - `role`: `admin`
   - `full_name`: Admin's name

Or run this SQL (replace with actual user ID):

```sql
-- First, get the user ID from auth.users
-- Then insert into profiles
INSERT INTO public.profiles (id, phone_number, role, full_name)
VALUES (
  'user-uuid-here',  -- Replace with actual user UUID
  '+1234567890',     -- Admin phone number
  'admin',
  'Admin User'
);
```

## Testing the Setup

### Test 1: Check Tables Exist

```sql
SELECT COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE';
```

Should return 10.

### Test 2: Check RLS Policies

```sql
SELECT COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public';
```

Should return multiple policies (one for each table).

### Test 3: Check Functions

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;
```

Should see:
- is_admin
- is_courier
- is_sender
- update_updated_at_column
- create_parcel_status_entry

## Troubleshooting

### Error: "relation already exists"
- Tables may have been partially created
- Drop existing tables and re-run migrations
- **Warning**: This will delete all data!

### Error: "permission denied"
- Make sure you're using the service role key for admin operations
- Check that RLS policies are correctly set up

### Error: "function does not exist"
- Make sure you ran `001_initial_schema.sql` before `002_rls_policies.sql`
- Functions are created in the first migration

## Next Steps

After successful setup:

1. ✅ Database schema is ready
2. ✅ RLS policies are active
3. ⏭️ Proceed with Milestone 2: Parcel & Trip Flows
4. ⏭️ Set up authentication flows
5. ⏭️ Test with sample data

## Support

If you encounter issues:
1. Check Supabase logs in the dashboard
2. Verify environment variables are set correctly
3. Ensure migrations were run in order
4. Review the `supabase/README.md` for detailed documentation



