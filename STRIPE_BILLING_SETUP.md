# Stripe Billing Setup

## Run Migration First

Run the billing migration in Supabase SQL Editor:

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/012_billing_and_pricing.sql`
3. Paste and Run

## Environment Variables

Add these to `.env.local` and Vercel:

```bash
# Stripe (required for payments)
STRIPE_SECRET_KEY=sk_test_xxxxx          # or sk_live_xxxxx for production
STRIPE_WEBHOOK_SECRET=whsec_xxxxx       # From Stripe Dashboard > Webhooks
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx  # Optional, for client-side

# Platform commission (optional, default 15%)
PLATFORM_COMMISSION_PERCENT=15
```

## Stripe Dashboard Setup

1. **Create account**: https://dashboard.stripe.com
2. **Get API keys**: Developers > API keys
3. **Create webhook**:
   - Developers > Webhooks > Add endpoint
   - URL: `https://your-domain.com/api/stripe/webhook`
   - Events: `checkout.session.completed`, `charge.refunded`
   - Copy the signing secret to `STRIPE_WEBHOOK_SECRET`

## Pricing Configuration

Default rates are in `delivery_pricing` table (migration 012). To add or edit:

```sql
INSERT INTO delivery_pricing (origin_country, destination_country, base_fee, rate_per_km, max_distance_km, currency, is_domestic)
VALUES ('ZW', 'ZA', 25.00, 0.10, 500, 'USD', false)
ON CONFLICT (origin_country, destination_country) DO UPDATE SET base_fee = EXCLUDED.base_fee, rate_per_km = EXCLUDED.rate_per_km;
```

## Flow

1. **Courier accepts match** → Pricing calculated (domestic km-based or international country-pair), stored in match
2. **Sender views parcel** → Sees "Pay now" if payment pending
3. **Sender clicks Pay** → Redirected to Stripe Checkout
4. **Payment complete** → Webhook updates `payment_status` to `paid`
5. **Courier payout** → Not built yet. Options: (a) **Stripe Connect** — couriers onboard as Express accounts; you transfer their share after delivery; (b) **Manual** — record payouts in the `payouts` table and pay by bank transfer.
