# 📱 Supabase Phone Authentication Setup

## Enable Phone Authentication in Supabase

To use phone-based authentication with Supabase, you need to configure it in your Supabase dashboard.

---

## Step 1: Enable Phone Provider

1. **Go to Supabase Dashboard:**
   - Visit: https://app.supabase.com/project/zleorpeqpbyttemxgedi

2. **Navigate to Authentication:**
   - Click on **"Authentication"** in the left sidebar
   - Click on **"Providers"** tab

3. **Enable Phone Provider:**
   - Find **"Phone"** in the list of providers
   - Toggle it **ON**
   - Click **"Save"**

---

## Step 2: Configure SMS Provider (Optional)

**Note:** We're using Twilio WhatsApp for OTP delivery, so you don't need to configure Supabase's SMS provider. However, if you want Supabase to handle SMS as a fallback:

1. **In Phone Provider Settings:**
   - You can configure Twilio as the SMS provider
   - Or use Supabase's built-in SMS (requires credits)

2. **For our use case:**
   - We send OTP via WhatsApp (Twilio)
   - We store OTP in our database
   - We verify OTP manually
   - So Supabase SMS provider is **not required**

---

## Step 3: Verify Settings

1. **Check Authentication Settings:**
   - Go to **Authentication** → **Settings**
   - Ensure **"Enable phone signup"** is enabled
   - Ensure **"Enable phone login"** is enabled

2. **Site URL:**
   - Make sure your site URL is set correctly
   - For local development: `http://localhost:3000`
   - For production: Your Vercel URL

---

## Step 4: Test Phone Authentication

After enabling:

1. **Try sending OTP:**
   - Visit: http://localhost:3000/login
   - Enter phone number: `+37256129522`
   - Click "Send Verification Code"

2. **Check WhatsApp:**
   - You should receive OTP via WhatsApp

3. **Verify OTP:**
   - Enter the OTP code
   - Should create/login user

---

## Important Notes

### Phone Number Format
- ✅ **Correct:** `+37256129522` (no spaces)
- ❌ **Wrong:** `+372 5612 9522` (with spaces)

Our code now automatically normalizes phone numbers, so both formats work!

### Twilio WhatsApp Setup
- Make sure your Twilio WhatsApp number is verified
- For testing: Use Twilio Sandbox
- For production: Request WhatsApp Business API access

### Database Migration
- Make sure you've run the `003_otp_storage.sql` migration
- This creates the `otp_codes` table for storing OTPs

---

## Troubleshooting

### Error: "Phone provider not enabled"
- **Solution:** Enable Phone provider in Supabase Dashboard → Authentication → Providers

### Error: "Invalid phone number"
- **Solution:** Ensure phone number is in E.164 format (e.g., `+37256129522`)

### Error: "OTP not received"
- **Check:** Twilio credentials in `.env.local`
- **Check:** Twilio WhatsApp number is correct
- **Check:** Phone number is registered in Twilio Sandbox (for testing)

---

## Current Status

✅ **Phone normalization:** Fixed (removes spaces automatically)
✅ **OTP storage:** Database table ready
✅ **WhatsApp integration:** Twilio configured
⏳ **Supabase Phone Auth:** Needs to be enabled in dashboard

---

**Next Step:** Enable Phone provider in Supabase Dashboard!


