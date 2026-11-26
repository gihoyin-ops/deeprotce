# Contributing to DeepChat

Thanks for helping build DeepChat. Keep changes focused, readable, and easy for the rest of the team to review.

## Setup

1. Copy `.env.example` to `.env.local` and set the variables you need.
2. Install dependencies with `pnpm install`.
3. Run `pnpm dev` to work locally.

Never commit `.env.local`, `data/`, or local `.sqlite` files.

## Branch & Pull Request Workflow

1. Create a short, descriptive branch from `main` (for example `fix/usage-limit-header` or `feat/model-selector`).
2. Keep each PR focused on one change or fix so reviews stay fast.
3. Run checks locally before pushing:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

4. Fill out the PR template with what changed and how you verified it.

## Code Guidelines

- **Keep code clear:** Use descriptive variable and function names. Split large functions when they get hard to follow.
- **Comment the why, not the what:** Add brief comments when a workaround, edge case, or non-obvious constraint needs context for the next developer.
- **Mobile-first UI:** Test layout changes on narrow mobile viewports first, then verify desktop.
- **Keep dependencies lean:** Discuss new packages with the team before adding them to `package.json`.
