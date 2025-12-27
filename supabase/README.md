# Supabase Database Setup

This directory contains the database schema and migrations for QikParcel MVP.

## Files

- `migrations/001_initial_schema.sql` - Creates all database tables, indexes, and triggers
- `migrations/002_rls_policies.sql` - Sets up Row Level Security (RLS) policies
- `migrations/003_otp_storage.sql` - Creates OTP storage table for phone authentication
- `migrations/004_add_profile_fields.sql` - Adds address and email fields to profiles table
- `migrations/005_create_courier_documents_storage.sql` - Creates storage bucket policies for courier documents

## Setup Instructions

### Option 1: Using Supabase Dashboard (Recommended for Milestone 1)

1. Log in to your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of `001_initial_schema.sql`
4. Click **Run** to execute
5. Repeat for `002_rls_policies.sql`
6. Repeat for `003_otp_storage.sql`
7. Repeat for `004_add_profile_fields.sql`
8. For `005_create_courier_documents_storage.sql`: First create the storage bucket manually (see Step 5 below), then run the SQL policies

### Step 4: Add Profile Fields

1. Create a new query in SQL Editor
2. Open `supabase/migrations/004_add_profile_fields.sql`
3. Copy the entire contents
4. Paste into the SQL Editor
5. Click **Run**

### Step 5: Create Storage Bucket for Courier Documents

See detailed instructions in [`../SETUP_STORAGE_BUCKET.md`](../SETUP_STORAGE_BUCKET.md)

**Quick Steps:**
1. Go to **Storage** in Supabase Dashboard
2. Click **Create a new bucket**
3. Name it: `courier-documents` (must be exact, lowercase with hyphen)
4. Set it to **Private** (do NOT check "Public bucket")
5. Click **Create bucket**
6. Go to **SQL Editor** and run the policies from `supabase/migrations/005_create_courier_documents_storage.sql`
7. Verify policies were created successfully

### Option 2: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Initialize Supabase (if not already done)
supabase init

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

**Note:** For storage bucket, you still need to create it manually in the dashboard as storage buckets cannot be created via SQL.

### Option 3: Using psql

If you have direct database access:

```bash
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/001_initial_schema.sql
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/002_rls_policies.sql
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/003_otp_storage.sql
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/004_add_profile_fields.sql
```

**Note:** Storage bucket still needs to be created manually in the dashboard.

## Database Schema Overview

### Core Tables

- **profiles** - User profiles (extends auth.users)
- **parcels** - Parcel requests from senders
- **trips** - Courier routes/trips
- **parcel_trip_matches** - Matching between parcels and trips

### Messaging

- **message_threads** - WhatsApp conversation threads linked to parcels
- **messages** - Individual WhatsApp messages

### Status & History

- **parcel_status_history** - Timeline of parcel status changes

### Admin & KYC

- **courier_kyc** - Courier verification documents
- **disputes** - Dispute management
- **payouts** - Manual payout tracking

## Row Level Security (RLS)

All tables have RLS enabled with policies that ensure:

- Users can only access their own data
- Senders can view/create their parcels
- Couriers can view/create their trips
- Matched parcels are visible to both sender and courier
- Admins have full access to all data
- System operations use service role key (bypasses RLS)

## Testing the Setup

After running migrations, verify:

1. Tables are created:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

2. RLS is enabled:
```sql
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public';
```

3. Policies are created:
```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

## Next Steps

After setting up the database:

1. Create an admin user manually (or via Supabase dashboard)
2. Test RLS policies with different user roles
3. Set up authentication flows (Milestone 2)
4. Begin implementing parcel and trip creation (Milestone 2)

## Notes

- All timestamps use `TIMESTAMPTZ` for timezone support
- UUIDs are used for all primary keys
- Foreign keys have `ON DELETE CASCADE` for data integrity
- Automatic `updated_at` triggers are set up on relevant tables
- Status history is automatically created when parcel status changes



