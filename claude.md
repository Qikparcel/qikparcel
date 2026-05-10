# CLAUDE.md

## Project Overview
- App: `QikParcel` (Next.js 14, App Router, TypeScript)
- Auth: Supabase phone OTP
- Database: Supabase PostgreSQL (SQL migrations in `supabase/migrations`)
- Styling: Tailwind CSS

## Local Development
- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Type check: `npm run type-check`
- Lint: `npm run lint`

## Testing
- Run e2e tests: `npm run test:e2e`
- Open Playwright UI mode: `npm run test:e2e:ui`
- E2E tests are located in `tests/e2e`
- Playwright config is in `playwright.config.ts`

## Database and Migrations
- Migration SQL files: `supabase/migrations`
- Run migration helper script: `npm run migrate`
- Keep migrations idempotent when possible (safe to run more than once)

## Important App Routes
- `/` redirects to `/login`
- `/login` handles OTP sign-in
- `/signup` handles multi-step sign-up + OTP verification
- `/dashboard` is the authenticated area

## Bidding System (sealed reverse auction)

Optional flow on top of fixed-price matching, gated by `NEXT_PUBLIC_BIDDING_ENABLED=1`.
Senders create a parcel with `pricing_mode=bidding`; KYC-approved couriers submit bids
(50%–150% of computed estimate). Sender picks a winner; the bid is converted into a
standard accepted `parcel_trip_matches` row so payments and status flow are unchanged.

Failure handling (no bids / abandonment / winner withdraws / payment timeout) is
controlled by `parcels.fallback_mode` (`fixed | rebid | cancel`) with engaged-but-failed
couriers added to `parcel_courier_exclusions` and (where applicable) `courier_strikes`.

### Bidding env vars
- `NEXT_PUBLIC_BIDDING_ENABLED=1` — enable feature flag
- `CRON_SECRET=...` — required for `/api/cron/bidding-close` Bearer auth

### Bidding API surface
- `POST /api/bidding/parcels/:id/bids` — courier submits/updates bid
- `DELETE /api/bidding/parcels/:id/bids/:bidId` — courier withdraws active bid
- `GET /api/bidding/parcels/:id/bids` — sender (own parcel), bidding courier (own bid), admin
- `POST /api/bidding/parcels/:id/bids/:bidId/accept` — sender picks winner
- `POST /api/bidding/parcels/:id/close` — sender closes bidding early
- `POST /api/bidding/parcels/:id/withdraw-winner` — winning courier backs out (pre-payment)
- `GET  /api/cron/bidding-close` — scheduled job, closes expired windows

### Tunables (in `lib/bidding/config.ts`)
- Window options (h): 1, 4, 12, 24 (default 4)
- Bid bounds: 50%–150% of estimate
- Pick-winner window after close: 24h
- Payment window after pick: 6h
- Strike suspension: 3 active strikes within 30 days

### Schema (migration `026_bidding_system.sql`)
- `parcels` columns: `pricing_mode`, `bidding_opens_at`, `bidding_closes_at`,
  `bidding_min/max/estimate_amount`, `bidding_currency`, `bidding_attempt_count`,
  `max_bidding_attempts`, `fallback_mode`
- `parcel_bids` — sealed bids per (parcel, courier)
- `parcel_courier_exclusions` — soft per-parcel blocklist applied by matching finder
- `courier_strikes` — account-level strikes; suspends matching candidacy beyond threshold
- `active_courier_strike_count(courier_id, within_days)` — RPC helper

## Code Guidelines
- Prefer small, focused changes
- Reuse existing utility functions (e.g., `lib/utils/phone.ts`)
- Avoid introducing new dependencies unless necessary
- Keep user-facing forms resilient with clear validation errors
