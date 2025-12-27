# Complete Signup Setup Guide

This guide will walk you through setting up the complete signup flow with role-specific forms and document uploads.

## Overview

The signup flow now supports two types of users:

1. **Sender** - Needs: Full Name, Phone, Address, Email
2. **Courier** - Needs: Full Name, Phone, Address, ID Document

## Prerequisites

- Supabase project created
- Database migrations 001-004 completed
- Storage bucket setup (see `SETUP_STORAGE_BUCKET.md`)

## Complete Setup Steps

### Step 1: Run Database Migrations

If you haven't already, run these migrations in order:

1. `001_initial_schema.sql` - Creates all tables
2. `002_rls_policies.sql` - Sets up security policies
3. `003_otp_storage.sql` - Creates OTP storage table
4. `004_add_profile_fields.sql` - Adds address and email to profiles

**How to run:**
- Go to Supabase Dashboard > SQL Editor
- Copy and paste each migration file
- Click "Run"
- Wait for "Success" message

### Step 2: Set Up Storage Bucket

Follow the detailed guide in `SETUP_STORAGE_BUCKET.md`

**Quick summary:**
1. Create bucket named `courier-documents` (Private)
2. Run the SQL policies from `005_create_courier_documents_storage.sql`

### Step 3: Verify Your Setup

Run these queries to verify everything is set up correctly:

```sql
-- Check profiles table has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name IN ('address', 'email');

-- Check storage policies exist
SELECT policyname 
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%courier%';

-- Verify courier_kyc table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'courier_kyc';
```

You should see:
- ✅ `address` and `email` columns in profiles
- ✅ At least 4 storage policies for courier documents
- ✅ `courier_kyc` table exists

### Step 4: Test the Signup Flow

#### Test as Sender:

1. Go to `/signup` page
2. **Step 1 - Basic Info:**
   - Enter Full Name: "John Doe"
   - Enter Phone: "+923224916205" (or your test number)
   - Select "Sender (I want to send parcels)"
   - Click "Next"

3. **Step 2 - Sender Details:**
   - Enter Address: "123 Main Street, City, Country"
   - Enter Email: "john@example.com"
   - Click "Send Verification Code"

4. **Step 3 - OTP Verification:**
   - Check WhatsApp for verification code
   - Enter the 6-digit code
   - Click "Verify & Sign Up"
   - You should be redirected to dashboard

#### Test as Courier:

1. Go to `/signup` page
2. **Step 1 - Basic Info:**
   - Enter Full Name: "Jane Courier"
   - Enter Phone: "+923224916206" (different test number)
   - Select "Courier (I want to deliver parcels)"
   - Click "Next"

3. **Step 2 - Courier Details:**
   - Enter Address: "456 Delivery Road, City, Country"
   - Select ID Document Type: "National ID"
   - Click "Choose File" and upload a test document (JPEG, PNG, or PDF, max 5MB)
   - You should see the file name appear
   - Click "Send Verification Code"

4. **Step 3 - OTP Verification:**
   - Check WhatsApp for verification code
   - Enter the 6-digit code
   - Click "Verify & Sign Up"
   - You should be redirected to dashboard

### Step 5: Verify Data Was Saved

Check that all data was saved correctly:

```sql
-- Check profile was created with all fields
SELECT id, full_name, phone_number, role, address, email, created_at
FROM public.profiles
WHERE phone_number LIKE '%your-test-number%'
ORDER BY created_at DESC
LIMIT 1;

-- For courier, check KYC document was saved
SELECT ck.id, ck.courier_id, ck.id_document_url, ck.id_document_type, ck.verification_status
FROM public.courier_kyc ck
JOIN public.profiles p ON p.id = ck.courier_id
WHERE p.phone_number LIKE '%your-courier-number%';

-- Check file exists in storage
-- Go to Storage > courier-documents in Supabase Dashboard
-- Look for folder with user ID
-- File should be inside that folder
```

### Step 6: Check Storage Bucket

1. Go to Supabase Dashboard > Storage > courier-documents
2. You should see folders named with user IDs (UUIDs)
3. Inside each courier's folder, you should see uploaded documents
4. Click on a file to verify it uploaded correctly

## Troubleshooting

### Issue: "Failed to upload document"

**Possible causes:**
- Storage bucket doesn't exist → Create it (see `SETUP_STORAGE_BUCKET.md`)
- Storage policies not set up → Run `005_create_courier_documents_storage.sql`
- File too large → Keep files under 5MB
- Invalid file type → Only JPEG, PNG, PDF allowed

**Solution:**
1. Verify bucket exists: Storage > courier-documents
2. Check policies: Run the storage policies SQL again
3. Check file size and type before upload

### Issue: "Address/Email not saving"

**Possible causes:**
- Migration `004_add_profile_fields.sql` not run
- API endpoint error

**Solution:**
1. Run migration `004_add_profile_fields.sql`
2. Check browser console for errors
3. Check API route logs

### Issue: "Profile updated but KYC document not saved"

**Possible causes:**
- Document upload failed but profile update succeeded
- courier_kyc table error

**Solution:**
1. Check if file uploaded to storage bucket
2. Check courier_kyc table for entry
3. Review server logs for errors

### Issue: "OTP verification works but redirects back to login"

**Possible causes:**
- Magic link tokens not being set
- Session not persisting

**Solution:**
1. Check browser console for errors
2. Verify tokens are in URL hash after redirect
3. Check if session is being set correctly

## Environment Variables Required

Make sure these are set in your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## API Endpoints Used

1. `POST /api/auth/send-otp` - Sends OTP via WhatsApp
2. `POST /api/auth/verify-otp` - Verifies OTP and creates user
3. `POST /api/auth/upload-document` - Uploads courier documents to storage
4. `POST /api/auth/update-profile` - Updates profile with address, email, documents

## Data Flow

### Sender Signup Flow:
1. User enters basic info (name, phone, selects sender)
2. User enters address and email
3. OTP sent via WhatsApp
4. User verifies OTP
5. User account created
6. Profile updated with address and email
7. User redirected to dashboard

### Courier Signup Flow:
1. User enters basic info (name, phone, selects courier)
2. User enters address and uploads ID document
3. Document uploaded to storage bucket
4. OTP sent via WhatsApp
5. User verifies OTP
6. User account created
7. Profile updated with address
8. Courier KYC record created with document path
9. User redirected to dashboard

## Next Steps

After setup is complete:

1. ✅ Users can sign up as senders or couriers
2. ✅ Sender profiles include address and email
3. ✅ Courier profiles include address and documents
4. ✅ Documents are securely stored in Supabase Storage
5. ⏭️ Implement document verification for admins
6. ⏭️ Add profile editing functionality
7. ⏭️ Add document re-upload for couriers if rejected

