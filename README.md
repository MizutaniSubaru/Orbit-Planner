# Orbit Planner

An AI-first task calendar manager built with `Next.js`, `Bun`, and `Supabase`.

## What It Does

- Google sign-in via Supabase Auth
- Natural-language intake in Chinese and English
- AI classification into calendar events vs. to-do items
- Confirmation card before creating ambiguous or inferred events
- Month view, week view, and filtered to-do rail
- One-way Google Calendar sync for app-created events

## Requirements

- Bun `1.3.11` or newer
- A Supabase project with Google Auth configured
- Optional AI provider credentials:
  - `OPENAI_*` for OpenAI-compatible models
  - or `KIMI_*` for Moonshot/Kimi

## Local Setup

```bash
bun install
cp .env.example .env.local
```

Then configure:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- AI credentials if you want model-backed parsing

If no AI key is configured, the app falls back to a lightweight heuristic parser for local testing.

## Supabase Setup

1. Run the SQL in [`supabase/schema.sql`](./supabase/schema.sql).
2. Enable Google Auth in Supabase.
3. Add the Google Calendar scope to your Google provider setup:
   - `https://www.googleapis.com/auth/calendar`
4. Set the OAuth redirect URL to:
   - `http://localhost:3000/auth/callback`

## Commands

```bash
bun run dev
bun run lint
bun run build
```

## Notes

- Google sync is one-way: app changes push to Google Calendar.
- The app does not pull changes back from Google Calendar.
- Repeating events, reminders, and team collaboration are intentionally out of scope for `v1`.
