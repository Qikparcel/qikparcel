# Client Account Requirements - QikParcel MVP

**Date:** December 4, 2025  
**Milestone:** 1 - Setup & Architecture

Dear Client,

To proceed with Milestone 1, we require you to create and provide access to the following accounts and services. Please create these accounts and share the necessary credentials/access tokens securely.

---

## Required Accounts & Access

### 1. **Twilio Account & WhatsApp API**

- **Purpose:** WhatsApp messaging integration via Twilio
- **What to create:**
  - Twilio account (https://www.twilio.com)
  - Twilio WhatsApp Sandbox (for testing) OR
  - Twilio WhatsApp Business Account (for production)
- **What we need:**
  - Account SID
  - Auth Token
  - WhatsApp-enabled Phone Number (Twilio number)
  - WhatsApp Sandbox Join Code (for testing only)
- **Instructions:**
  1.  Sign up at https://www.twilio.com
  2.  Verify your email and phone number
  3.  Go to Console > Messaging > Try it out > Send a WhatsApp message
  4.  For testing: Use WhatsApp Sandbox (join code will be provided)
  5.  For production: Request WhatsApp Business API access
  6.  Get your Account SID and Auth Token from Console > Settings
  7.  Get your WhatsApp-enabled phone number from Console > Phone Numbers
- **Status:** ⏳ Pending

---

### 2. **Supabase Account**

- **Purpose:** Database, authentication, and real-time features
- **What to create:**
  - Supabase project (https://supabase.com)
- **What we need:**
  - Project URL
  - Project API Key (anon/public key)
  - Project Service Role Key (for admin operations)
  - Database password (if setting up new project)
- **Instructions:**
  1.  Sign up at https://supabase.com
  2.  Create a new project
  3.  Choose a region closest to your users
  4.  Note down the credentials from Settings > API
- **Status:** ⏳ Pending

---

### 3. **Vercel Account**

- **Purpose:** Frontend deployment and hosting
- **What to create:**
  - Vercel account (https://vercel.com)
- **What we need:**
  - Account access (add developer as team member) OR
  - GitHub repository access (if using GitHub integration)
- **Instructions:**
  1.  Sign up at https://vercel.com
  2.  Connect your GitHub account (recommended)
  3.  Add developer as collaborator or provide repo access
- **Status:** ⏳ Pending

---

### 4. **GitHub Repository (Optional but Recommended)**

- **Purpose:** Version control and code management
- **What to create:**
  - New private repository for QikParcel
- **What we need:**
  - Repository URL
  - Access permissions (admin or write access)
- **Instructions:**
  1.  Create a new private repository
  2.  Add developer as collaborator with write access
- **Status:** ⏳ Pending

---

### 5. **Environment Variables Template**

Once accounts are created, we'll need the following environment variables:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Twilio WhatsApp API
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=+1234567890
# Optional: For testing with Sandbox
TWILIO_WHATSAPP_SANDBOX_CODE=join abc-xyz

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Vercel (for deployment)
VERCEL_URL=your_vercel_url (auto-set)
```

---

## Security Notes

- **DO NOT** share credentials in email or chat
- Use a secure password manager or encrypted channel
- We recommend using Vercel's environment variables for production secrets
- Service role keys should be kept secret and never exposed to frontend

---

## Next Steps

1. Please create all accounts listed above
2. Share credentials securely (we can set up a secure channel)
3. Once received, we'll proceed with:
   - Project initialization
   - Database schema setup
   - WhatsApp webhook configuration
   - Deployment pipeline setup

---

## Questions or Issues?

If you encounter any issues creating these accounts or need assistance, please let us know immediately. Some accounts may require business verification which can take time.

**Estimated time to set up all accounts:** 1-2 hours (Twilio setup is faster than Meta)

---

**Status:** Awaiting client account creation
