# `src/backend/`, future full-server backend (skeleton only)

Not wired into the local-first app, not in the local build, no runtime code.
When the app leaves the Vercel free tier for a VPS + `.com`, this is where
the account, plan, and usage service lands. Local-first keeps working
unchanged until the cutover.

## Why now

The current ledger is a per-IP SQLite file (`data/deepchat-usage.sqlite`)
with a 5h + 7d dual window. Good for one machine or a LAN; it cannot hold
real accounts, billing webhooks, or durable multi-region state that a public
`.com` needs.

## Module map

| Future module | Absorbs (local-first) | Adds |
| --- | --- | --- |
| `db/` | `node:sqlite` files under `data/` | durable pool (Postgres/Neon), migrations |
| `auth/` | IP identity + `dc_session` cookie | accounts, login, real sessions |
| `admin/` | `DEEPCHAT_USAGE_ADMIN` env flag | operator-only plan elevation, audit trail |
| `meter/` | `usage.ts` + `plans.ts` + `usage-meter.ts` | account-keyed ledger, exact provider `usage` |
| `http/` | `src/app/api/**` handlers | `/api/account/**` + `/api/admin/**` routers |
| `config.ts` | `.env.local` providers | DB URL, session secret, webhook secret |

## Non-goals (this phase)

- No runnable code; every file is types + docblock so re-designing it later
  is cheap
- No driver import; `db/connection.ts` is engine-neutral until
  Postgres/Neon is picked
- No `process.env` reads; `config.ts` is pure shape

## Suggested cutover order

1. `db/`: pick engine, ready pool, seed schema (mirror `usage` table)
2. `auth/`: real accounts; migrate IP-linked plans into the account
3. `meter/`: point the meter at the account ledger; dual window (5h + 7d,
   same per-window cap) carries over as-is
4. `admin/`: plan elevation goes to an authenticated operator; the env flag
   retires
5. `http/`: mount `/api/account/**` + `/api/admin/**`; the existing
   `/api/usage*` becomes read-only under the account context
6. Local-first stays available as a read-only mirror
