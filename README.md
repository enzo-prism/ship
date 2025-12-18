# Project Ship

Project Ship is a simple public web app that shows a feed of recent GitHub commits across a fixed allowlist of `enzo-prism/*` repositories.

## Tech

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- GitHub REST API (server-side) using `GITHUB_TOKEN`
- No database, no auth

## Setup

Requirements:
- Node.js 20+
- npm

Install deps:
```bash
npm install
```

Create `.env.local`:
```bash
GITHUB_TOKEN=ghp_your_token_here
```

Notes:
- `.env*` is gitignored.
- The token is only used server-side in `src/app/api/commits/route.ts`.

## Run

```bash
npm run dev
```

Build + start:
```bash
npm run build
npm run start
```

## API

`GET /api/commits`

Query params:
- `repo=all` (default) or `repo=enzo-prism/<repo>` (must be in the allowlist)
- Either `range=7|30|60` (default: `7`) or `since=YYYY-MM-DD&until=YYYY-MM-DD` (max span: 60 days)

Examples:
- `/api/commits?repo=all&range=7`
- `/api/commits?repo=enzo-prism/pti&since=2025-01-01&until=2025-01-31`

Response:
```json
[
  {
    "sha": "…",
    "repo": "enzo-prism/pti",
    "htmlUrl": "https://github.com/…",
    "committedAt": "2025-01-01T12:34:56Z",
    "messageSubject": "…",
    "messageBody": "…"
  }
]
```

## Deploy (Vercel)

- Import `enzo-prism/ship`
- Add environment variable `GITHUB_TOKEN` in the Vercel project settings
- Deploy

This app caches GitHub API calls (revalidate ~60 seconds) to avoid calling GitHub on every request.

