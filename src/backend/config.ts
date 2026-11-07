// runtime env surface for the future server, shape only
// nothing here is read at build or local dev time
// the cutover extends .env.local, it does not replace it

export interface BackendEnv {
  // durable store, engine is picked at db wiring time
  DATABASE_URL: string;

  // opaque secret for issuing and verifying session refs
  SESSION_SECRET: string;

  // billing webhook secret when plan elevation via payment is on
  BILLING_WEBHOOK_SECRET: string;

  // provider keys stay on the existing LIVE_* LITE_* IMAGE_* names
}
