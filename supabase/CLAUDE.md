# supabase/

Edge Functions (Deno runtime) and database migrations for the remote Supabase project.

## Runtime: Deno, not Node

`functions/generate-breakdown/index.ts` runs on Deno:
- Imports use URLs: `import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'`
- Env: `Deno.env.get('KEY')` — not `process.env.KEY`
- No `package.json` or `node_modules` in the functions directory
- `fetch` is a global — no import needed

## Edge Function: generate-breakdown

**Purpose:** Proxies Anthropic API to avoid browser CORS. The only valid path to Claude Haiku from the frontend.

**Request:** `POST /functions/v1/generate-breakdown` with `{ vietnamese: string }`
**Response:** `{ breakdown: [{ vi: string, en: string }] }` or `{ error: string }`

**Model:** `claude-haiku-4-5-20251001`. Do not upgrade — Haiku is sufficient for this simple prompt and keeps latency low.

**Prompt returns JSON only.** Response parser strips markdown fences as a safety measure. If you change the prompt, ensure the output is still parseable JSON.

**Deploy:**
```bash
supabase functions deploy generate-breakdown --linked
```

**ANTHROPIC_API_KEY** lives in Supabase project secrets, not `.env`:
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --linked
```
`VITE_ANTHROPIC_API_KEY` in `.env` is unused — a leftover.

## Migrations

**Always use `--linked`** — there is no local Supabase stack.

**Two-table breakdown design:**
- `flashcards.breakdown` (JSONB nullable) — denormalized copy for fast card fetch (no JOIN needed)
- `breakdowns` table (`vi_key` PK) — cache so identical Vietnamese phrases only call Anthropic once

`vi_key` is the normalized phrase (trim + collapse whitespace via `normalizeVietnamese()`).

**`source` has no enum constraint** — dropped in `20260326044509_drop_source_check.sql`. Any string is valid; the frontend enforces valid values via localStorage categories.

**No RLS.** This is a single-user personal app. Adding RLS would break all existing client queries without a full audit.

## Upcoming: Quiz

No new tables or migrations needed for the Quiz feature. Quiz session state is ephemeral (held in React state only).
