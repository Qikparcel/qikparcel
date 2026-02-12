import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.warn("[STRIPE] STRIPE_SECRET_KEY not set - payments disabled");
}

export const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export function isStripeEnabled(): boolean {
  return !!stripeSecretKey;
}
