# DeepChat

Web AI chat platform running at [chat.deepsia.my.id](https://chat.deepsia.my.id), built with Next.js 16, React 19, TypeScript, and Tailwind CSS 4.

## Stack & Services

- **Frontend & API:** Next.js 16 (App Router), React 19, Tailwind CSS 4
- **AI Relay:** `AI_RELAY_BASE_URL` (default `https://api.deepsia.my.id`) for chat and image models
- **Database:** Turso (libSQL) for production/serverless deployments, with local SQLite support in `data/`
- **Auth:** Session-based auth with Email OTP (Brevo or Resend) and guest mode limits

## Requirements

- Node.js 20.9 or newer
- pnpm 10 (`corepack enable` or install pnpm globally)

## Local Development

1. Copy the example environment file and fill in your keys (AI Relay, Turso, auth secrets, and email provider):

```bash
cp .env.example .env.local
```

2. Install dependencies:

```bash
pnpm install
```

3. Start the development server:

```bash
pnpm dev
```

Open `http://localhost:3000` in your browser.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start Next.js development server |
| `pnpm build` | Build production bundle |
| `pnpm start` | Start compiled production server |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript type checking (`tsc --noEmit`) |

## Project Structure

```text
deepchat/
├── docs/            # Screenshots and reference docs
├── public/          # Static assets and icons
├── scripts/         # Self-host install and launch scripts
└── src/
    ├── app/         # Next.js App Router pages, layouts, and API routes
    ├── backend/     # Server-side database, auth, and backend helpers
    ├── components/  # UI components
    ├── lib/         # Shared utilities, AI model config, and client helpers
    └── types/       # TypeScript type definitions
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for branch, PR, and code guidelines.

## License

MIT. See [LICENSE](./LICENSE).
