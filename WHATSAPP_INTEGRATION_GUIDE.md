# WhatsApp Integration Guide - QikParcel MVP

## Mental Model: How WhatsApp Works in QikParcel

### The Big Picture

QikParcel is a **WhatsApp-first** logistics platform. This means:

- Users (senders & couriers) interact primarily through WhatsApp
- The web app is a secondary interface (for admin, tracking, etc.)
- All notifications and updates come via WhatsApp
- Real-time chat happens in WhatsApp, synced to the web app

---

## Twilio vs WhatsApp Cloud API: Which Should We Use?

### Option 1: WhatsApp Cloud API (Currently Planned) ✅

**Pros:**

- ✅ **Direct from Meta** - Official WhatsApp solution
- ✅ **Lower cost** - Free tier: 1,000 conversations/month
- ✅ **Better for scale** - Pay per conversation, not per message
- ✅ **Native WhatsApp features** - Full access to WhatsApp Business features
- ✅ **Template messages** - Pre-approved message templates for notifications
- ✅ **WhatsApp Business Profile** - Verified business account

**Cons:**

- ❌ **Business verification required** - Can take 1-2 weeks
- ❌ **More complex setup** - Meta Business Account, App setup
- ❌ **Template approval** - Need to submit message templates for approval
- ❌ **24-hour window** - Can only send free-form messages within 24h of user message

**Cost:**

- Free: 1,000 conversations/month
- Paid: ~$0.005-0.09 per conversation (varies by country)

---

### Option 2: Twilio WhatsApp API 🔄

**Pros:**

- ✅ **Easier setup** - Simpler onboarding process
- ✅ **Faster approval** - Usually approved within hours/days
- ✅ **Better developer experience** - Cleaner API, better documentation
- ✅ **More flexible** - Less strict template requirements
- ✅ **Unified platform** - Can use same account for SMS, voice, etc.

**Cons:**

- ❌ **Higher cost** - ~$0.005-0.015 per message (not per conversation)
- ❌ **Per-message pricing** - Can get expensive with high volume
- ❌ **Third-party** - One more layer between you and WhatsApp
- ❌ **Same 24-hour window** - Still subject to WhatsApp's messaging rules

**Cost:**

- ~$0.005-0.015 per message (varies by country)
- Example: 100 messages = $0.50-$1.50

---

## Recommendation

**For MVP: Use WhatsApp Cloud API** because:

1. Lower cost for conversations (not per message)
2. Direct from Meta (no middleman)
3. Better long-term scalability
4. Already specified in the contract

**Consider Twilio if:**

- Business verification is taking too long
- You need faster setup
- You want to use SMS as fallback

---

## Mental Model: How WhatsApp Integration Works

### 1. **Two-Way Communication Flow**

```
┌─────────────┐                    ┌──────────────┐                    ┌─────────────┐
│   Sender    │                    │  QikParcel   │                    │   Courier   │
│  (WhatsApp) │                    │   Backend    │                    │  (WhatsApp) │
└──────┬──────┘                    └──────┬───────┘                    └──────┬──────┘
       │                                   │                                   │
       │ 1. "I need to send a parcel"     │                                   │
       ├──────────────────────────────────>│                                   │
       │                                   │                                   │
       │                                   │ 2. Create parcel in DB             │
       │                                   │    Store sender's WhatsApp number  │
       │                                   │                                   │
       │                                   │ 3. Find matching courier           │
       │                                   │    (based on route, capacity)     │
       │                                   │                                   │
       │                                   │ 4. Send WhatsApp to courier        │
       │                                   ├───────────────────────────────────>│
       │                                   │    "New parcel match! Route: ..."  │
       │                                   │                                   │
       │                                   │ 5. Courier accepts                 │
       │                                   │<───────────────────────────────────┤
       │                                   │                                   │
       │ 6. "Your parcel is matched!"      │                                   │
       │<──────────────────────────────────┤                                   │
       │                                   │                                   │
       │ 7. "Where is my parcel?"          │                                   │
       ├──────────────────────────────────>│                                   │
       │                                   │                                   │
       │                                   │ 8. Check status, send update      │
       │                                   │    "Parcel is in transit..."       │
       │                                   │                                   │
       │ 9. "Parcel delivered!"           │                                   │
       │<──────────────────────────────────┤                                   │
       │                                   │                                   │
```

### 2. **Message Types We'll Send**

#### A. **Template Messages** (Pre-approved, can send anytime)

- ✅ "Your parcel has been matched with a courier"
- ✅ "Your parcel has been picked up"
- ✅ "Your parcel is in transit"
- ✅ "Your parcel has been delivered"
- ✅ "New parcel request on your route"

#### B. **Free-Form Messages** (Within 24h window)

- ✅ User asks: "Where is my parcel?" → We can reply freely
- ✅ Courier asks: "What's the pickup address?" → We can reply freely
- ✅ Real-time chat between sender and courier

### 3. **Webhook Flow (Receiving Messages)**

```
WhatsApp User sends message
         │
         ▼
WhatsApp Cloud API
         │
         ▼
POST /api/whatsapp/webhook (Our Next.js API route)
         │
         ▼
Extract: phone number, message text, message ID
         │
         ▼
Find or create message_thread in database
         │
         ▼
Link to parcel (if exists) by phone number
         │
         ▼
Save message to messages table
         │
         ▼
Process message:
  - If it's a command: "status", "help", etc.
  - If it's a question: Route to appropriate handler
  - If it's chat: Store and sync to web app
         │
         ▼
Send response (if needed)
         │
         ▼
Sync to web app via Supabase Realtime
```

### 4. **Outbound Messages (Sending)**

```
Event happens in system:
  - Parcel created
  - Parcel matched
  - Status changed
  - Courier accepts
         │
         ▼
Determine recipient phone number
         │
         ▼
Check: Is it within 24h window?
         │
         ├─ YES → Send free-form message
         │
         └─ NO → Send template message
         │
         ▼
Call WhatsApp API
         │
         ▼
Save message to database
         │
         ▼
Update message status (sent → delivered → read)
```

---

## What We're Building: Technical Implementation

### 1. **Webhook Endpoint** (`/api/whatsapp/webhook`)

- **GET**: Verification (Meta checks if we're legit)
- **POST**: Receives all incoming messages and events

### 2. **WhatsApp Client** (`lib/whatsapp/client.ts`)

- Send text messages
- Send template messages
- Handle webhook verification

### 3. **Database Tables**

- `message_threads` - Links WhatsApp conversations to parcels
- `messages` - Stores all WhatsApp messages (inbound & outbound)

### 4. **Message Processing Logic** (Milestone 5)

- Parse incoming messages
- Link to correct parcel/trip
- Handle commands ("status", "help")
- Route messages to correct thread
- Sync to web app in real-time

---

## Example User Flows

### Flow 1: Sender Creates Parcel via WhatsApp

```
1. Sender: "I need to send a package from A to B"
   → System: Creates parcel, stores WhatsApp number
   → System: "Got it! We're finding a courier for you..."

2. System finds match
   → System: "Great news! We found a courier. Your parcel will be picked up today at 2 PM"

3. Courier picks up
   → System: "Your parcel has been picked up! Track it here: [link]"

4. Parcel delivered
   → System: "Your parcel has been delivered! 🎉"
```

### Flow 2: Real-Time Chat

```
1. Sender: "Where is my parcel?"
   → System checks status
   → System: "Your parcel is in transit. ETA: 30 minutes"

2. Courier: "I'm at the pickup location"
   → System: "Sender will be notified"

3. Sender and Courier can chat
   → Messages synced to web app
   → Both see conversation in real-time
```

### Flow 3: Status Updates

```
Parcel status changes → System automatically sends WhatsApp:

pending → "We're finding a courier for your parcel"
matched → "Courier found! Pickup scheduled for [time]"
picked_up → "Parcel picked up! Tracking: [link]"
in_transit → "Parcel is on the way. ETA: [time]"
delivered → "Parcel delivered! 🎉"
```

---

## Key Concepts

### 1. **24-Hour Window**

- After user sends a message, we have 24 hours to send free-form messages
- After 24 hours, we can only send pre-approved template messages
- **Solution**: Use templates for notifications, free-form for responses

### 2. **Message Threading**

- Each parcel gets a `message_thread`
- Links sender's WhatsApp number to parcel
- Links courier's WhatsApp number when matched
- All messages in that thread are linked to the parcel

### 3. **Bidirectional Sync**

- WhatsApp messages → Saved to database → Shown in web app
- Web app messages → Sent via WhatsApp API → Shown in WhatsApp
- Real-time sync using Supabase Realtime

### 4. **Phone Number as Identity**

- Users identified by WhatsApp phone number
- Linked to user profile in database
- Can have multiple parcels, one thread per parcel

---

## Implementation Plan

### Milestone 1 (Current) ✅

- ✅ WhatsApp webhook endpoint setup
- ✅ WhatsApp client library
- ✅ Database schema for messages

### Milestone 3

- Auto-send notifications when parcel matched
- Template messages for status updates

### Milestone 4

- Auto-send status updates (picked up, in transit, delivered)

### Milestone 5

- Process incoming messages
- Link messages to parcels
- Real-time chat sync
- Command handling ("status", "help")

---

## Should We Switch to Twilio?

**My Recommendation: Stick with WhatsApp Cloud API**

**Reasons:**

1. Already in contract/scope
2. Lower cost for conversations
3. Direct from Meta (better long-term)
4. We've already built for it

**But if you want Twilio:**

- I can refactor the code (it's similar API)
- Faster setup might be worth it
- Need to update client requirements doc

**What do you prefer?** I can switch to Twilio if you think it's better for the MVP timeline.

