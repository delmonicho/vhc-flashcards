# Cô Ơi — Claude Notes

## Tech Stack

- React 19 + Vite 8 + Tailwind CSS v4 (via `@tailwindcss/vite` plugin, no `tailwind.config.js`)
- Supabase (Postgres + Edge Functions) — project ref `zmbfpwjbnqsqywdeymow`
- Google Translate API for English translations, Anthropic Claude Haiku via Edge Function for breakdowns

## Navigation

No React Router. App.jsx uses a custom `view` state (`{ page, weekId }`). Pages receive `onNavigate(page, id?)` as a prop. There is no browser history — navigating always re-fetches data from Supabase.

## Tailwind Color Tokens

Custom colors use the `co-` prefix (defined in `src/index.css` `@theme` block). Always use these instead of generic Tailwind grays/reds for brand elements:

| Token | Use |
|-------|-----|
| `co-primary` | Rose/coral — main actions |
| `co-ink` | Dark brown — primary text |
| `co-muted` | Taupe — secondary text |
| `co-border` | Soft peach — borders |
| `co-surface` | Warm off-white — card backgrounds |
| `co-fern` | Green — Study button |
| `co-gold` | Amber — homework tag |

Dark mode uses Tailwind's `.dark` class (not `prefers-color-scheme` at render time). Every dark-mode text color must be explicit: `text-co-ink dark:text-gray-100`.

Fonts: `font-display` = Baloo 2 (headings), `font-sans` = Nunito (body).

## Database Schema

```
weeks         id, title, created_at
flashcards    id, week_id, vietnamese, english, source (any string), status, breakdown (JSONB nullable), created_at
breakdowns    vi_key (PK), breakdown (JSONB)   ← cache table
```

`breakdowns.vi_key` is the normalized Vietnamese phrase (`trim + collapse whitespace` via `normalizeVietnamese()` in `src/lib/breakdown.js`). Always use this function before any cache lookup or upsert.

## State Management

No Redux or Context. Each page owns its local state. Supabase client is imported directly everywhere (`import { supabase } from '../lib/supabase'`). Optimistic UI updates are common — update local state immediately, then await the DB write.

## Edge Functions

Deployed to Supabase Edge Runtime (Deno). The only function is `generate-breakdown`:

```bash
# Deploy
supabase functions deploy generate-breakdown --linked

# Requires ANTHROPIC_API_KEY set in Supabase project secrets (not in .env)
```

The Edge Function proxies Anthropic to avoid browser CORS. Never call the Anthropic API directly from the frontend.

## Supabase CLI

Always use `--linked` to target the remote (production) database:

```bash
supabase inspect db table-stats --linked   # row counts + sizes
supabase db dump --linked                  # schema dump
```

Local Supabase stack is not used. Available inspect subcommands: `bloat`, `calls`, `index-stats`, `long-running-queries`, `outliers`.

## Key Gotchas

- **Speech API**: `speakVietnamese()` must be called from a user gesture (click handler). iOS requires this — don't call it in `useEffect` or async background tasks.
- **Breakdown regeneration**: If `vietnamese` text changes on a card, `breakdown` is wiped and re-queued. Preserve breakdown if only `english` or `source` changes.
- **Tailwind v4**: No config file. Customize via `@theme` and `@custom-variant` in `src/index.css`. Don't create a `tailwind.config.js`.
- **Search/filter is client-side**: All cards for a week are loaded at once. No pagination needed for current scale.
- **`VITE_ANTHROPIC_API_KEY`** in `.env` is unused at runtime — it's a leftover. The key lives in Supabase secrets and is only read by the Edge Function.
- **`source` column has no enum constraint** — the old `('class'|'homework')` check was dropped in migration `20260326044509`. Any string is valid; the category system in localStorage is the source of truth for valid values.

## localStorage Keys

| Key | Owner | Value |
|-----|-------|-------|
| `'theme'` | `src/App.jsx` | `'dark'` or `'light'` |
| `'viet-categories'` | `src/lib/categories.js` | JSON array of category objects |
| `'viVoiceBannerDismissed'` | `src/pages/Study.jsx` | `'1'` when dismissed |
