# Storage Bucket Setup Guide for Courier Documents

This guide will help you set up the Supabase storage bucket for storing courier ID documents.

## Prerequisites

- Access to Supabase Dashboard
- Database migrations `001_initial_schema.sql` through `004_add_profile_fields.sql` should already be run

## Step-by-Step Instructions

### Step 1: Create the Storage Bucket

1. Log in to your [Supabase Dashboard](https://app.supabase.com)
2. Select your QikParcel project
3. Navigate to **Storage** in the left sidebar
4. Click the **"New bucket"** button (or **"Create a new bucket"**)
5. Fill in the bucket details:
   - **Name**: `courier-documents` (must be exact, lowercase with hyphen)
   - **Public bucket**: Leave this **UNCHECKED** (keep it private)
   - **File size limit**: Leave default or set to 5 MB (5242880 bytes)
   - **Allowed MIME types**: Leave empty (all types allowed) or add:
     - `image/jpeg`
     - `image/png`
     - `image/jpg`
     - `application/pdf`
6. Click **"Create bucket"**
7. Wait for the bucket to be created (you should see it in the list)

### Step 2: Set Up Storage Policies

1. In Supabase Dashboard, navigate to **SQL Editor** in the left sidebar
2. Click **"New query"**
3. Open the file `supabase/migrations/005_create_courier_documents_storage.sql` from your project
4. **Important**: Copy the ENTIRE file contents (from line 1 to the end)
5. Make sure you're copying all the CREATE POLICY statements, not just the bucket name
6. Paste it into the SQL Editor
7. Click **"Run"** (or press Cmd/Ctrl + Enter)
8. Wait for "Success" message

**If you get a syntax error:**
- Make sure you copied the entire SQL file, not just part of it
- Check that you're copying all 5 CREATE POLICY statements
- You can also use the cleaner version: `005_create_courier_documents_storage_CLEAN.sql`

### Step 3: Verify the Setup

Run these queries in SQL Editor to verify the policies were created:

```sql
-- Check if storage policies exist
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%courier%'
ORDER BY policyname;
```

You should see 4 policies:
- `Couriers can upload own documents`
- `Couriers can read own documents`
- `Admins can read all documents`
- `Couriers can update own documents`
- `Couriers can delete own documents`

### Step 4: Test the Setup (Optional)

You can test if the bucket is accessible by:

1. Going to **Storage** > **courier-documents**
2. Try uploading a test file (you should be able to upload if authenticated)
3. Check that the file appears in the bucket

## How It Works

### File Structure
Files are stored with the following path pattern:
```
courier-documents/
  └── {user_id}/
      └── {timestamp}-{filename}
```

Example:
```
courier-documents/
  └── 16c61746-4397-47d5-a369-cf82a55b6770/
      └── 1766635267-national_id.pdf
```

### Security Policies

- **Couriers** can only upload, read, update, and delete their own documents (files in their user ID folder)
- **Admins** can read all documents (for verification purposes)
- **Other users** cannot access courier documents

### Document Types Supported

- JPEG images (`.jpg`, `.jpeg`)
- PNG images (`.png`)
- PDF documents (`.pdf`)
- Maximum file size: 5 MB

## Troubleshooting

### Error: "Bucket does not exist"
- Make sure you created the bucket with the exact name `courier-documents`
- Check that the bucket appears in the Storage list

### Error: "Permission denied" when uploading
- Verify that the storage policies were created successfully
- Make sure you're running the policies with the service role key (they should work anyway)
- Check that the user is authenticated when trying to upload

### Error: "File too large"
- Check the bucket's file size limit in Storage settings
- Ensure uploaded files are under 5 MB

### Policies not appearing
- Make sure you ran the SQL from `005_create_courier_documents_storage.sql`
- Verify there are no errors in the SQL Editor output
- Try running the policies again

## Next Steps

After completing this setup:

1. ✅ Storage bucket is ready
2. ✅ Security policies are configured
3. ✅ Courier document upload will work in the signup flow
4. ⏭️ Test the signup process with a courier account
5. ⏭️ Verify documents appear in the storage bucket

## Support

If you encounter issues:

1. Check Supabase logs in the dashboard
2. Verify all migrations are run in order
3. Ensure the bucket name matches exactly: `courier-documents`
4. Review the storage policies for any syntax errors

