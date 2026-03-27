# src/lib

Utility and service modules. Each has sharp edges worth knowing before editing.

## breakdown.js

**4-step pipeline order is load-bearing:**
1. Check `breakdowns` cache table by `vi_key`
2. If miss, call Edge Function (Anthropic CORS proxy)
3. Upsert result into `breakdowns` cache (`onConflict: 'vi_key'` handles races)
4. Write `breakdown` to the specific `flashcards` row by `cardId`

Steps 3 and 4 must not be reversed. Always call `getOrCreateBreakdown(vi, cardId, en?)` after the card is already saved to DB — if the card doesn't exist yet, the flashcard update silently no-ops.

**`getOrCreateBreakdown(vietnameseText, cardId, englishText?)`** — `englishText` is optional but should always be passed from call sites. It's forwarded to the Edge Function and included in the Claude prompt so ambiguous words (e.g. "đá" = kick vs. dump) resolve to the correct meaning. The cache key is still VI-only — English context only affects generation, not cache lookup.

**`triggerMissingBreakdowns()`** — dev/one-time utility. Fetches all cards with `breakdown = null` and calls `getOrCreateBreakdown` for each. Run from the browser console after bulk imports or data migrations.

**`normalizeVietnamese(text)`** — always call before any cache lookup or upsert. Trims and collapses internal whitespace. Skipping it causes cache misses for the same phrase with different spacing.

**Breakdown JSONB shape:** `[{ vi: string, en: string }]` — ordered array, both fields required.

**`backfillBreakdownCache()`** is dev-only. Do not call from production paths.

## categories.js

**localStorage key is `'viet-categories'`** (see `STORAGE_KEY` constant at line 11).

**Default categories:** `[{ id: 'class', label: 'Class', color: '#FFCCD5' }, { id: 'homework', label: 'Homework', color: '#FFF0C0' }]`.

**Category `id` is stored as `flashcards.source` in the DB.** `addCategory()` slugifies the label. Renaming a category label does NOT update existing card `source` values — they stay associated by id. Categories are global (not per-week).

## speak.js

**iOS constraint:** `speakVietnamese()` must be called synchronously within a user gesture handler. Never call from `useEffect`, `setTimeout`, or async chains not directly triggered by a gesture.

**Always call `cancelSpeech()`** before navigating away or switching cards. Study.jsx calls it in `goTo()`. Any new navigation that bypasses `goTo` must also call it.

**Banner key:** `'viVoiceBannerDismissed'` — stores string `'1'` when dismissed. Check with `localStorage.getItem(key)` (truthy string, not boolean).

## translate.js

**HTML entity decoding is required.** Google Translate returns HTML-encoded output (`&#39;`, `&amp;`, etc.). The textarea trick decodes all entities. Do not replace with regex/string replace — it won't handle all entities. This runs browser-only (uses DOM `document`).

## supabase.js

Single export: `supabase` client. Import directly everywhere — no wrapper, no abstraction. No RLS — all tables are public. Do not add RLS without auditing all query patterns.

## colors.js

`CHUNK_COLORS` uses arbitrary Tailwind values (`bg-[#...]`) as literal strings in the array. Tailwind v4 scans source for class strings — if you move them to variables or template literals, Tailwind won't include them in the build. They must appear as-is in source.

## mastery.js

**localStorage keys:** `'quiz-mastery'` and `'quiz-xp'`.

**Mastery schema:** `{ "card-uuid": { correct, incorrect, streak, lastSeen } }`. `streak` resets to 0 on any wrong answer, increments on correct. `getWeight` returns `2` when `streak < 3 && incorrect > 0` — back to `1` after 3 consecutive correct.

**`weightedSample(cards, n, store)`** — weight-2 cards appear twice in the pool before Fisher-Yates shuffle; deduplicates by id. Pass `cards.length` as `n` to get all cards in weighted order.

**XP schema:** `{ weekStart: timestampMs, xp: number }`. `loadXP()` auto-resets if stored `weekStart` differs from the current Monday (UTC). `addXP(amount)` loads, adds, saves, returns new total. `XP_RATES = { mc: 1, match: 2, quickfire: 1, tiles: 1.5 }` — multiply by score to get XP earned.

**`recordResult(cardId, wasCorrect, store)`** mutates `store` in place — always pass a shallow copy (`{ ...masteryData }`) so React state updates correctly.
