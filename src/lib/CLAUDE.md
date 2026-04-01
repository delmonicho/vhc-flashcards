# src/lib

Utility and service modules. Each has sharp edges worth knowing before editing.

## logger.js

**Three exports:** `logError(message, meta?)`, `logEvent(message, meta?)`, `logPerf(message, meta?)`. All write to the Supabase `logs` table as fire-and-forget inserts (never awaited, never throws).

**`meta` fields for `logError`:** `{ page?, action?, err?, details? }`. `err` accepts an `Error` object or Supabase error object — it is serialized to `{ message, name, stack }` inside `details.error`. `details` is merged in as additional JSONB context.

**Instrumentation rule: log where you swallow.** If a function throws, the *caller* logs — not the function. If a function silently absorbs an error (e.g. a cache write that doesn't re-throw), log inside that function. This prevents double-logging.

**`logEvent` and `logPerf` are stubs for future use.** Call sites for click events and perf measurements TBD.

**Graceful degradation:** If Supabase is down, the logger silently no-ops in production. In dev (`import.meta.env.DEV`), it prints a `console.warn`.

## breakdown.js

**4-step pipeline order is load-bearing:**
1. Check `breakdowns` cache table by `vi_key`
2. If miss, call Edge Function (Anthropic CORS proxy)
3. Upsert result into `breakdowns` cache (`onConflict: 'vi_key'` handles races)
4. Write `breakdown` to the specific `flashcards` row by `cardId`

Steps 3 and 4 must not be reversed. Always call `getOrCreateBreakdown(vi, cardId, en?)` after the card is already saved to DB — if the card doesn't exist yet, the flashcard update silently no-ops.

**`batchGetOrCreateBreakdowns(cards, onCardReady)`** — use this for bulk import flows (e.g. PDF import). Takes an array of `{id, vietnamese, english}` objects and a callback fired as each breakdown becomes available. Collapses N cache reads, N cache writes, and N flashcard updates into 1 each via a batch SELECT, batch UPSERT, and the `bulk_update_card_breakdowns` RPC. Edge Function calls remain 1-per-cache-miss (unavoidable). `onCardReady(cardId, breakdown)` is called as each breakdown resolves so the UI can update incrementally.

**`getOrCreateBreakdown(vietnameseText, cardId, englishText?)`** — `englishText` is optional but should always be passed from call sites. It's forwarded to the Edge Function and included in the Claude prompt so ambiguous words (e.g. "đá" = kick vs. dump) resolve to the correct meaning. The cache key is still VI-only — English context only affects generation, not cache lookup.

**`triggerMissingBreakdowns()`** — dev/one-time utility. Fetches all cards with `breakdown = null` and calls `getOrCreateBreakdown` for each. Run from the browser console after bulk imports or data migrations.

**`normalizeVietnamese(text)`** — always call before any cache lookup or upsert. Trims and collapses internal whitespace. Skipping it causes cache misses for the same phrase with different spacing.

**`stripDiacritics(str)`** — strips all combining diacritical marks via `normalize('NFD')` + regex. Used for fuzzy search: "nam" matches "năm", "nắm", "nám", etc. Do not use for cache keys — use `normalizeVietnamese` for that.

**Breakdown JSONB shape:** `[{ vi: string, en: string }]` — ordered array, both fields required.

**`backfillBreakdownCache()`** is dev-only. Do not call from production paths.

## categories.js

All functions (`loadCategories`, `addCategory`, `deleteCategory`) are **async** and backed by the Supabase `categories` table.

**One-time migration:** The first `loadCategories()` call checks for `'viet-categories'` in localStorage. If found, it upserts those rows to Supabase and deletes the localStorage key. After migration, localStorage is no longer used.

**Default categories:** `[{ id: 'class', label: 'Class', color: '#FFCCD5' }, { id: 'homework', label: 'Homework', color: '#FFF0C0' }]` — seeded in the migration SQL if the table is empty.

**Category `id` is stored as `flashcards.source` in the DB.** `addCategory()` slugifies the label to produce a stable id. Renaming a category label does NOT update existing card `source` values — they stay associated by id. Categories are global (not per-week).

## speak.js

**iOS constraint:** `speakVietnamese()` must be called synchronously within a user gesture handler. Never call from `useEffect`, `setTimeout`, or async chains not directly triggered by a gesture.

**Always call `cancelSpeech()`** before navigating away or switching cards. Study.jsx calls it in `goTo()`. Any new navigation that bypasses `goTo` must also call it.

**Banner key:** `'viVoiceBannerDismissed'` — stores string `'1'` when dismissed. Check with `localStorage.getItem(key)` (truthy string, not boolean).

## translate.js

Proxies requests to `/api/translate` (Vercel serverless function). `GOOGLE_API_KEY` never touches the client bundle. Function signature `translateToEnglish(text)` is unchanged.

**HTML entity decoding is required.** Google Translate returns HTML-encoded output (`&#39;`, `&amp;`, etc.). The textarea trick decodes all entities. Do not replace with regex/string replace — it won't handle all entities. This runs browser-only (uses DOM `document`).

## auth.js

Thin wrappers over Supabase auth. Exports: `signInWithMagicLink(email)`, `signInWithGoogle()`, `signInWithPassword(email, password)`, `signUpWithPassword(email, password)`, `signOut()`, `getCurrentUser()`, `getProfile(userId)`, `updateProfile(userId, updates)`, `deleteAccount()`. Import `useAuth()` from `AuthContext` in components instead of calling these directly.

**Google OAuth** requires the Google provider to be enabled in the Supabase Dashboard (Authentication → Providers) with valid Client ID + Secret from Google Cloud Console. The authorized redirect URI in Google Cloud must include `https://zmbfpwjbnqsqywdeymow.supabase.co/auth/v1/callback`. The `signInWithGoogle()` call redirects the browser away — no in-page callback needed.

## supabase.js

Single export: `supabase` client. Import directly everywhere — no wrapper, no abstraction. RLS is enabled — all queries are automatically scoped to `auth.uid()`.

## colors.js

`CHUNK_COLORS` uses arbitrary Tailwind values (`bg-[#...]`) as literal strings in the array. Tailwind v4 scans source for class strings — if you move them to variables or template literals, Tailwind won't include them in the build. They must appear as-is in source.

## mastery.js

**localStorage keys:** `'quiz-mastery'` and `'quiz-xp'`.

**Mastery schema:** `{ "card-uuid": { correct, incorrect, streak, lastSeen } }`. `streak` resets to 0 on any wrong answer, increments on correct. `getWeight` returns `2` when `streak < 3 && incorrect > 0` — back to `1` after 3 consecutive correct.

**`weightedSample(cards, n, store)`** — weight-2 cards appear twice in the pool before Fisher-Yates shuffle; deduplicates by id. Pass `cards.length` as `n` to get all cards in weighted order.

**XP schema:** `{ weekStart: timestampMs, xp: number }`. `loadXP()` auto-resets if stored `weekStart` differs from the current Monday (UTC). `addXP(amount)` loads, adds, saves, returns new total. `XP_RATES = { mc: 1, match: 2, quickfire: 1, tiles: 1.5 }` — multiply by score to get XP earned.

**`recordResult(cardId, wasCorrect, store)`** mutates `store` in place — always pass a shallow copy (`{ ...masteryData }`) so React state updates correctly.

## pdfImport.js

Two async exports used by `PdfImportModal`:

**`extractPdfText(file)`** — reads a `File` object via `FileReader`, base64-encodes it, POSTs to `/api/pdf-extract`, returns raw text string. Throws on HTTP error or read failure.

**`parseVocabPairs(text)`** — calls the `parse-vocab` Supabase Edge Function via `supabase.functions.invoke()`, returns `{ pairs: [{vietnamese, english}], truncated: boolean }`. Uses the same `ANTHROPIC_API_KEY` secret as `generate-breakdown` — no Vercel env var needed.
