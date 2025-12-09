# Credentials Needed from Client

**Date:** December 4, 2025  
**Tech Stack:** Twilio, Supabase, Vercel

---

## 🔑 Required Credentials

### 1. **Twilio Account** ✅

**What we need:**

- [ ] **Account SID** - Found in Twilio Console > Settings
- [ ] **Auth Token** - Found in Twilio Console > Settings (keep this secret!)
- [ ] **WhatsApp Phone Number** - Your Twilio WhatsApp-enabled number (format: `+1234567890` or `whatsapp:+1234567890`)
- [ ] **Sandbox Join Code** (for testing only) - If using WhatsApp Sandbox for testing

**Where to find:**

1. Log in to https://console.twilio.com
2. Go to **Settings** (top right) → **General**
3. Copy **Account SID** and **Auth Token**
4. Go to **Phone Numbers** → **Manage** → **Active numbers**
5. Find your WhatsApp-enabled number

**For Testing (Sandbox):**

- Go to **Messaging** → **Try it out** → **Send a WhatsApp message**
- You'll see a join code like "join abc-xyz"
- Users need to send this code to your Twilio WhatsApp number to join sandbox

**For Production:**

- Request WhatsApp Business API access from Twilio
- This requires business verification

---

### 2. **Supabase Account** ✅

**What we need:**

- [ ] **Project URL** - Your Supabase project URL (format: `https://xxxxx.supabase.co`)
- [ ] **Anon/Public Key** - Public API key (safe to expose in frontend)
- [ ] **Service Role Key** - Private key (keep secret! Only for backend)

**Where to find:**

1. Log in to https://app.supabase.com
2. Select your project
3. Go to **Settings** (gear icon) → **API**
4. Copy:
   - **Project URL** (under "Project URL")
   - **anon public** key (under "Project API keys")
   - **service_role** key (under "Project API keys" - click "Reveal")

---

### 3. **Vercel Account** ✅

**What we need:**

- [ ] **Vercel Account Access** - Add developer as team member OR
- [ ] **GitHub Repository Access** - If using GitHub integration

**Options:**

- **Option A:** Add developer email as team member in Vercel project
- **Option B:** Provide GitHub repository access (developer can deploy via GitHub)

**Where to set up:**

1. Log in to https://vercel.com
2. Go to your project (or create new)
3. **Settings** → **Team** → Add team member
   OR
4. Connect GitHub repository in project settings

---

### 4. **GitHub Repository** (Optional but Recommended)

**What we need:**

- [ ] **Repository URL** - GitHub repository link
- [ ] **Access** - Add developer as collaborator with write access

**Where to set up:**

1. Create repository at https://github.com (private recommended)
2. Go to **Settings** → **Collaborators** → **Add people**
3. Add developer email with **Write** access

---

## 📋 Environment Variables Template

Once you have all credentials, we'll set up these environment variables:

### Local Development (`.env.local`)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_NUMBER=+1234567890
# Optional: For testing
TWILIO_WHATSAPP_SANDBOX_CODE=join abc-xyz

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Vercel Production

Same variables, but set in Vercel dashboard:

1. Go to project → **Settings** → **Environment Variables**
2. Add each variable
3. Select environments (Production, Preview, Development)

---

## 🔒 Security Notes

- **NEVER** share credentials in email or chat
- Use a secure password manager or encrypted channel
- Service Role Key and Auth Token should be kept secret
- Only share Anon/Public keys in frontend code
- Vercel environment variables are encrypted at rest

---

## ✅ Checklist

Before we can proceed with Milestone 1:

- [ ] Twilio Account SID
- [ ] Twilio Auth Token
- [ ] Twilio WhatsApp Number
- [ ] Supabase Project URL
- [ ] Supabase Anon Key
- [ ] Supabase Service Role Key
- [ ] Vercel access (team member or GitHub repo)
- [ ] GitHub repository (optional)

---

## 🚀 Next Steps After Receiving Credentials

1. ✅ Set up environment variables
2. ✅ Run Supabase database migrations
3. ✅ Configure Twilio webhook URL
4. ✅ Test WhatsApp webhook
5. ✅ Deploy to Vercel
6. ✅ Test end-to-end flow

---

## 📞 Questions?

If you have any issues getting these credentials, let me know and I can help guide you through the process!
