# Milestone 1 - Complete Setup Guide 🚀

**QikParcel MVP - Setup & Architecture**

This guide will walk you through completing Milestone 1 step-by-step.

---

## ✅ Prerequisites Check

Before starting, verify you have:
- [x] Node.js 18+ installed (`node --version`)
- [x] npm or yarn installed
- [x] All credentials received (Twilio + Supabase)
- [x] `.env.local` file created (already done!)

---

## Step 1: Install Dependencies

```bash
cd /Users/nomanashraf/Desktop/QKPARCEL
npm install
```

**Expected output:** Dependencies installed successfully.

---

## Step 2: Set Up Supabase Database

### 2.1 Open Supabase Dashboard

1. Go to: https://app.supabase.com/project/zleorpeqpbyttemxgedi
2. Log in if needed
3. Click **"SQL Editor"** in the left sidebar

### 2.2 Run Initial Schema Migration

1. Click **"New Query"** button (top right)
2. Open the file: `supabase/migrations/001_initial_schema.sql`
3. **Copy the entire contents** of the file
4. **Paste** into the SQL Editor
5. Click **"Run"** button (or press `Cmd/Ctrl + Enter`)
6. Wait for **"Success. No rows returned"** message

**What this does:**
- Creates all database tables (profiles, parcels, trips, messages, etc.)
- Sets up indexes for performance
- Creates triggers for automatic updates

### 2.3 Run RLS Policies Migration

1. Click **"New Query"** again
2. Open the file: `supabase/migrations/002_rls_policies.sql`
3. **Copy the entire contents** of the file
4. **Paste** into the SQL Editor
5. Click **"Run"** button
6. Wait for **"Success. No rows returned"** message

**What this does:**
- Enables Row Level Security on all tables
- Creates security policies for users, couriers, and admins
- Ensures users can only access their own data

### 2.4 Verify Database Setup

Run this query in SQL Editor to verify:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

**Expected result:** You should see these 10 tables:
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

✅ **If you see all tables, database setup is complete!**

---

## Step 3: Test Supabase Connection

Run the test script:

```bash
node scripts/test-supabase.js
```

**Expected output:**
```
🧪 Testing Supabase Connection...
✅ Connection successful! Tables exist.
✅ Supabase connection test complete!
```

If you see errors about tables not existing, go back to Step 2 and run the migrations.

---

## Step 4: Test WhatsApp Integration

### 4.1 Test via Script

```bash
node scripts/test-whatsapp.js
```

Or test with a different number:
```bash
node scripts/test-whatsapp.js +1234567890
```

**Expected output:**
```
🧪 Testing WhatsApp Integration...
✅ Message sent successfully!
💡 Check your WhatsApp to see the message!
```

### 4.2 Test via API Endpoint

Start the dev server first:

```bash
npm run dev
```

Then in another terminal:

```bash
curl -X POST http://localhost:3000/api/whatsapp/test \
  -H "Content-Type: application/json" \
  -d '{"to": "+923224916205", "message": "Hello from QikParcel!"}'
```

**Expected response:**
```json
{
  "success": true,
  "messageSid": "SM...",
  "status": "queued"
}
```

### 4.3 Test Webhook (Receive Messages)

1. Make sure dev server is running: `npm run dev`
2. **Important:** For local testing, you need to expose your localhost
   - Use **ngrok**: `ngrok http 3000`
   - Or use **Twilio CLI**: `twilio phone-numbers:update +14155238886 --sms-url http://your-ngrok-url.ngrok.io/api/whatsapp/webhook`
3. Send a WhatsApp message to `+14155238886`
4. Check your terminal logs - you should see:
   ```
   Received WhatsApp message: { from: '+923224916205', ... }
   ```

**Note:** For production, you'll configure the webhook URL in Twilio dashboard after deploying to Vercel.

---

## Step 5: Start Development Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

**Expected:** You should see the QikParcel MVP homepage.

---

## Step 6: Verify All Components

### 6.1 Check Environment Variables

Verify `.env.local` exists and has all variables:
```bash
cat .env.local
```

Should show:
- ✅ NEXT_PUBLIC_SUPABASE_URL
- ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
- ✅ SUPABASE_SERVICE_ROLE_KEY
- ✅ TWILIO_ACCOUNT_SID
- ✅ TWILIO_AUTH_TOKEN
- ✅ TWILIO_WHATSAPP_NUMBER
- ✅ TWILIO_CONTENT_SID

### 6.2 Check Database Tables

In Supabase Dashboard → Table Editor, verify you can see:
- profiles
- parcels
- trips
- messages
- etc.

### 6.3 Check API Endpoints

Visit these URLs (with dev server running):
- http://localhost:3000 - Homepage
- http://localhost:3000/api/whatsapp/webhook - Webhook endpoint (GET returns status)

---

## Step 7: Milestone 1 Checklist

Verify all items are complete:

- [x] **Next.js + Supabase + Tailwind setup**
  - [x] Next.js 14 project created
  - [x] Supabase client configured
  - [x] Tailwind CSS configured

- [x] **Database schema**
  - [x] All tables created
  - [x] Indexes created
  - [x] Triggers created

- [x] **Auth + RLS policies**
  - [x] RLS enabled on all tables
  - [x] Security policies created
  - [x] Role-based access configured

- [x] **WhatsApp (Twilio) API setup**
  - [x] Twilio client configured
  - [x] Webhook endpoint created
  - [x] Test endpoints created

- [x] **Vercel deployment pipeline**
  - [x] Project structure ready
  - [x] Environment variables documented
  - [ ] Deployed to Vercel (optional for now)

- [x] **Functional environment**
  - [x] Local dev server runs
  - [x] Database connected
  - [x] WhatsApp integration works

- [x] **WA webhook tested**
  - [x] Webhook endpoint responds
  - [x] Can receive messages (with ngrok)
  - [x] Can send messages

---

## Troubleshooting

### Issue: "Missing environment variables"

**Solution:**
- Check `.env.local` exists in project root
- Verify all variables are set
- Restart dev server after changing `.env.local`

### Issue: "Tables don't exist"

**Solution:**
- Go back to Step 2
- Run both SQL migrations in Supabase SQL Editor
- Verify with the SQL query in Step 2.4

### Issue: "WhatsApp message not sending"

**Solution:**
- Verify Twilio credentials in `.env.local`
- Check Twilio account has credits
- Verify phone number format: `whatsapp:+1234567890`
- Check Twilio console for error logs

### Issue: "Webhook not receiving messages"

**Solution:**
- For local testing, use ngrok to expose localhost
- Configure webhook URL in Twilio dashboard
- Check server logs for incoming requests
- Verify webhook URL is accessible

### Issue: "Supabase connection failed"

**Solution:**
- Verify Supabase URL and keys in `.env.local`
- Check Supabase project is active
- Verify network connection
- Check Supabase status page

---

## Next Steps (Milestone 2)

Once Milestone 1 is complete, you're ready for:

1. **Parcel Creation Flow**
   - Create parcel request form
   - Store in database
   - Send WhatsApp notification

2. **Trip Creation Flow**
   - Create courier trip
   - Store in database
   - Link to available parcels

3. **Basic Dashboard**
   - View parcels
   - View trips
   - Status tracking

4. **Parcel Timeline UI**
   - Show status history
   - Real-time updates

---

## Deployment to Vercel (Optional for Milestone 1)

If you want to deploy now:

1. **Push to GitHub** (if using version control)
2. **Import to Vercel:**
   - Go to https://vercel.com
   - Click "Add New" → "Project"
   - Import repository
3. **Add Environment Variables:**
   - Go to Project Settings → Environment Variables
   - Add all variables from `.env.local`
   - Select all environments
4. **Deploy**

After deployment, configure Twilio webhook:
- Go to Twilio Console → Messaging → Settings → WhatsApp
- Set webhook URL to: `https://your-app.vercel.app/api/whatsapp/webhook`

---

## 🎉 Milestone 1 Complete!

If all steps above are completed successfully, **Milestone 1 is done!**

**Deliverables:**
- ✅ Functional Next.js environment
- ✅ Supabase database with schema
- ✅ RLS policies configured
- ✅ Twilio WhatsApp integration
- ✅ Webhook endpoint working
- ✅ Ready for Milestone 2

---

## Support

If you encounter any issues:
1. Check the troubleshooting section above
2. Review error messages in terminal/logs
3. Verify all credentials are correct
4. Check Supabase and Twilio dashboards for errors

**Status:** Ready to proceed! 🚀

