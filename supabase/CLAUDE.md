# supabase/

Edge Functions (Deno runtime) and database migrations for the remote Supabase project.

## Runtime: Deno, not Node

`functions/generate-breakdown/index.ts` runs on Deno:
- Imports use URLs: `import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'`
- Env: `Deno.env.get('KEY')` — not `process.env.KEY`
- No `package.json` or `node_modules` in the functions directory
- `fetch` is a global — no import needed

## Edge Function: batch-breakdown

**Purpose:** Generates morpheme breakdowns for multiple Vietnamese words in a single Claude call. Used by `batchGetOrCreateBreakdowns()` during PDF import to avoid rate-limiting from N concurrent requests.

**Request:** `POST /functions/v1/batch-breakdown` with `{ cards: [{vietnamese, english?}] }` (max 20 per call)
**Response:** `{ results: [{breakdown: [{vi, en}]}] }` — array in same order as input, matched by index.

**Model:** `claude-haiku-4-5-20251001`. Processes up to 20 words per call; caller chunks larger imports.

**Deploy:**
```bash
supabase functions deploy batch-breakdown --project-ref zmbfpwjbnqsqywdeymow
```

## Edge Function: parse-vocab

**Purpose:** Extracts `[{vietnamese, english}]` flashcard pairs from raw PDF text. Uses the same `ANTHROPIC_API_KEY` secret as `generate-breakdown`. Called by `src/lib/pdfImport.js` via `supabase.functions.invoke('parse-vocab', { body: { text } })`.

**Request:** `POST /functions/v1/parse-vocab` with `{ text: string }`
**Response:** `{ pairs: [{vietnamese, english}], truncated?: true }` — `truncated` is set when input exceeded 15,000 chars.

**Model:** `claude-haiku-4-5-20251001`. System prompt handles `=` and `:` delimiters, `><` antonym pairs (extracts each side), and skips poetry/grammar examples.

**Deploy:**
```bash
supabase functions deploy parse-vocab --project-ref zmbfpwjbnqsqywdeymow
```

## Edge Function: generate-breakdown

**Purpose:** Proxies Anthropic API to avoid browser CORS. The only valid path to Claude Haiku from the frontend.

**Request:** `POST /functions/v1/generate-breakdown` with `{ vietnamese: string, english?: string }`
**Response:** `{ breakdown: [{ vi: string, en: string }] }` or `{ error: string }`

`english` is optional. When provided it is injected into the Claude prompt as context so ambiguous words resolve to the right meaning. Cache lookup is unaffected — the key is always VI-only.

**Model:** `claude-haiku-4-5-20251001`. Do not upgrade — Haiku is sufficient for this simple prompt and keeps latency low.

**Prompt returns JSON only.** Response parser strips markdown fences as a safety measure. If you change the prompt, ensure the output is still parseable JSON.

**Deploy:**
```bash
supabase functions deploy generate-breakdown --project-ref zmbfpwjbnqsqywdeymow
```

**ANTHROPIC_API_KEY** lives in Supabase project secrets, not `.env`:
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref zmbfpwjbnqsqywdeymow
```
`VITE_ANTHROPIC_API_KEY` in `.env` is unused — a leftover.

## Migrations

**Always use `--linked`** — there is no local Supabase stack.

**Two-table breakdown design:**
- `flashcards.breakdown` (JSONB nullable) — denormalized copy for fast card fetch (no JOIN needed)
- `breakdowns` table (`vi_key` PK) — cache so identical Vietnamese phrases only call Anthropic once

`vi_key` is the normalized phrase (trim + collapse whitespace via `normalizeVietnamese()`).

**`source` has no enum constraint** — dropped in `20260326044509_drop_source_check.sql`. Any string is valid; the frontend enforces valid values via the Supabase `categories` table.

**RLS is enabled** on `decks`, `flashcards`, `game_stats`, and `profiles`. All rows are user-scoped via `user_id = auth.uid()`. Flashcards use a subquery via deck ownership. The `breakdowns` and `categories` tables are shared/public caches and have no RLS.

**RPC functions:**
- `bulk_update_card_breakdowns(updates jsonb)` — added in `20260401000000`. Takes a JSON array of `{id: uuid, breakdown: jsonb}` objects and updates all matching flashcards in a single query. Used by `batchGetOrCreateBreakdowns()` in `src/lib/breakdown.js`. RLS applies (only updates caller's own cards).

**Recent migrations:**
- `20260327000000_add_game_stats.sql` — per-deck game performance (XP, cards mastered, streak). `unique(deck_id)` constraint; streak logic: increment if last played yesterday or today, reset if gap > 1 day.
- `20260327100000_add_categories_table.sql` — global categories (migrated from localStorage). `id` is text PK (slugified label).
- `20260328100000_auth_profiles.sql` — adds `user_id` to `decks` and `flashcards`; creates `profiles` table with auto-create trigger on `auth.users` insert; enables RLS on all user tables; adds `delete_user()` security-definer function.
- `20260329000000_public_decks.sql` — adds `is_public boolean` to decks (default false); fixes `game_stats` unique constraint from `(deck_id)` to `(user_id, deck_id)`; updates decks/flashcards SELECT policies to include public rows; relaxes profiles SELECT to allow any authenticated read.
- `20260328200000_rename_weeks_to_decks.sql` — renames `weeks` table to `decks`, `week_id` columns to `deck_id` in `flashcards` and `game_stats`, rebuilds affected RLS policies.
