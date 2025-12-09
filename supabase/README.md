# Supabase Database Setup

This directory contains the database schema and migrations for QikParcel MVP.

## Files

- `migrations/001_initial_schema.sql` - Creates all database tables, indexes, and triggers
- `migrations/002_rls_policies.sql` - Sets up Row Level Security (RLS) policies

## Setup Instructions

### Option 1: Using Supabase Dashboard (Recommended for Milestone 1)

1. Log in to your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of `001_initial_schema.sql`
4. Click **Run** to execute
5. Repeat for `002_rls_policies.sql`

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

### Option 3: Using psql

If you have direct database access:

```bash
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/001_initial_schema.sql
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/002_rls_policies.sql
```

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



