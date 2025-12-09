# QikParcel MVP

WhatsApp-first logistics platform for connecting senders with couriers.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Styling:** Tailwind CSS
- **Deployment:** Vercel
- **Messaging:** Twilio WhatsApp API

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Supabase account (see `CLIENT_ACCOUNT_REQUIREMENTS.md`)
- Twilio account with WhatsApp access (see `CLIENT_ACCOUNT_REQUIREMENTS.md`)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
```

Fill in the required values (see `CLIENT_ACCOUNT_REQUIREMENTS.md` for details).

3. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
qikparcel-mvp/
├── app/                    # Next.js 14 App Router
│   ├── api/               # API routes
│   │   └── whatsapp/     # WhatsApp webhook
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── lib/                   # Utilities and helpers
│   ├── supabase/         # Supabase client setup
│   └── whatsapp/         # WhatsApp API helpers
├── components/            # React components (coming in Milestone 2)
├── types/                 # TypeScript types (coming in Milestone 2)
└── public/               # Static assets
```

## Milestones

- [x] Milestone 1: Setup & Architecture (In Progress)
- [ ] Milestone 2: Parcel & Trip Flows
- [ ] Milestone 3: Matching System + WhatsApp Automation
- [ ] Milestone 4: Parcel Status Automation
- [ ] Milestone 5: Real-Time Chat + WA Sync
- [ ] Milestone 6: KYC + Admin Tools
- [ ] Milestone 7: Testing and Bug Fixes

## API Endpoints

### WhatsApp Webhook (Twilio)
- `GET /api/whatsapp/webhook` - Health check
- `POST /api/whatsapp/webhook` - Receive WhatsApp messages and status updates

More endpoints will be added in subsequent milestones.

## Environment Variables

See `CLIENT_ACCOUNT_REQUIREMENTS.md` for the complete list of required environment variables.

## Documentation

- [Client Account Requirements](./CLIENT_ACCOUNT_REQUIREMENTS.md)
- API documentation (coming soon)
- Database schema (coming soon)

## License

Proprietary - All rights reserved by QikParcel OU
