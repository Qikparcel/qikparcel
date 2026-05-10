/**
 * Bidding system configuration.
 * All knobs centralized here so future tuning is one-file-change.
 */

export const BIDDING_CONFIG = {
  /** Feature flag — checked at API entry points and server pages. */
  enabled: process.env.NEXT_PUBLIC_BIDDING_ENABLED === "1",

  /** Bidding window options (hours) the sender can choose at parcel creation. */
  windowOptionsHours: [1, 4, 12, 24] as const,
  defaultWindowHours: 4,

  /** Bid bounds as a fraction of the calculated estimate. */
  minBidFactor: 0.5,
  maxBidFactor: 1.5,

  /** Time the sender has to pick a winner after bidding window closes (hours). */
  pickWinnerWindowHours: 24,

  /** Time the sender has to pay after picking a winner (hours). */
  paymentWindowHours: 6,

  /** Strike thresholds for bidding privileges. */
  strikeWindowDays: 30,
  strikeSuspensionThreshold: 3,

  /** Default fallback when no winner is selected. */
  defaultFallbackMode: "fixed" as const,

  /** Hard limit on rebid attempts (matches parcels.max_bidding_attempts default). */
  defaultMaxBiddingAttempts: 2,

  /** Rate limiting on bid submission (per courier per parcel). */
  bidSubmitCooldownSeconds: 5,
} as const;

export type BiddingWindowHours =
  (typeof BIDDING_CONFIG.windowOptionsHours)[number];

export function isBiddingEnabled(): boolean {
  return BIDDING_CONFIG.enabled;
}
