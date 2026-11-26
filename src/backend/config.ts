// Runtime env contract for the future server, shape only.
// Nothing here gets read at build time or local dev.
// The cutover extends .env.local, doesn't replace that shit.

export interface BackendEnv {
  // Durable DB connection string, engine gets picked when wiring the DB
  DATABASE_URL: string;

  // Opaque secret for minting and verifying session refs
  SESSION_SECRET: string;

  // Billing webhook secret for when paid plan upgrades go live
  BILLING_WEBHOOK_SECRET: string;

  // Provider keys stay on the existing LIVE_* LITE_* IMAGE_* env names
}
