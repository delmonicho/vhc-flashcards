# src/pages

Full-page views rendered by App.jsx. All receive `onNavigate(page, weekId?)`, `dark`, and `onToggleDark` props.

## Diagnostics.jsx

Dev-only page (`import.meta.env.DEV` guard in App.jsx). Accessible via the hamster wheel icon in the dev section of Home.jsx. Loads all data in parallel on mount.

**5 sections:** DB row counts (all tables), breakdown coverage progress bar, error hotspot table (grouped by page+action), recent errors (last 25, expandable to show details JSON), environment info.

**Queries:** Uses `{ count: 'exact', head: true }` for row counts (no rows returned). Error log queries hit the `logs` table directly. No caching — always fresh on load.

## App.jsx navigation

`view` state is `{ page, weekId, loginError }`. Adding a new page requires a new branch in App.jsx. No browser history, no URL routing — every `onNavigate` replaces the current view entirely.

Valid pages: `'home'`, `'week'`, `'study'`, `'quiz'`, `'lotus-quest'`, `'diagnostics'` (dev-only), `'login'`, `'auth/callback'`, `'profile'`, `'privacy'`. `login` and `privacy` bypass `AuthGuard`.

Dark mode: App.jsx owns localStorage persistence. Pages receive `dark` (boolean) as a prop — they do not read storage directly.

## Week.jsx

**Ownership:** `const isOwner = week?.user_id === user?.id` — derived from `useAuth()`, no extra state. Controls VocabInput visibility, search/filter toolbar, card click-to-edit, and "Copy to my decks" button.

**Author profile:** Week fetch uses `select('*, profiles(display_name, avatar_color)')`. When `!isOwner`, author name is shown below the deck title as `by {week.profiles.display_name}`. Note: `weeks.user_id → auth.users ← profiles.id` is an indirect FK — if the Supabase auto-join doesn't resolve, a separate profiles fetch fallback is used.

**`handleCopyDeck()`:** Creates a new private week (`is_public: false`) under `user.id`, then batch-inserts all cards preserving `vietnamese`, `english`, `source`, and `breakdown` (avoids re-calling Anthropic on copied cards). Navigates to the new week on success.

**Breakdown callback chain:** Two separate async paths both call `handleBreakdownReady(cardId, breakdown)` which does `setCards(prev => prev.map(...))`:
- `onCardBreakdownReady` → from VocabInput after new card creation
- `onBreakdownReady` → from CardEditModal after edit

Any new card creation path (bulk import, etc.) must also wire `handleBreakdownReady`.

**`lastClickedRef` pattern:** Stores the DOM element that opened CardEditModal so focus can return on close. If you add a second trigger for CardEditModal, store its element in the same `lastClickedRef` before calling `setEditingCard`.

**Categories write path:** Categories are now Supabase-backed (async). Call the async functions from `src/lib/categories.js` (`addCategory`, `deleteCategory`) and update the parent `categories` state via `onCategoriesChange` prop. Never mutate local state without also persisting to Supabase.

**Cards are sorted newest-first** (`created_at DESC`). New cards are prepended via `[newCard, ...prev]`.

## Home.jsx

**Tabbed view:** `tab` state (`'mine' | 'public'`). My Decks tab is default; Public Decks tab lazy-fetches on first activation (`publicFetched` flag prevents re-fetch on tab switch).

**`fetchPublicDecks()`:** Queries `weeks` filtered by `is_public = true` and `neq('user_id', user.id)`, then batch-fetches author profiles by unique `user_id`s. Result is stored in `publicDecks` — each item has an `author` property (`{ display_name, avatar_color }`).

**My Decks query must use `.eq('user_id', user.id)` explicitly** — after the public decks RLS migration, a plain select returns other users' public weeks too. Always scope to current user for the My Decks list.

**`togglePublic(week, e)`:** Optimistic update with revert on error. `togglingId` state holds the deck id currently being toggled (disables button + dims opacity during the DB write). Globe SVG = public, Lock SVG = private.

**Card count fetch** is a full-table scan of `flashcards` (id + week_id only). Post-RLS-migration this returns cards for public weeks too — counts are correct for public deck cards without any extra queries.

**Inline edit pattern:** Title editing replaces the title text with an input. Saves on `blur`/`Enter`, cancels on `Escape`. `editInputRef` is focused via `useEffect` when `editingWeekId` changes.

**Delete uses a bottom sheet** (not a modal) for mobile ergonomics. Keep destructive confirmations as bottom sheets on this page.

**Backfill button** is wrapped in `import.meta.env.DEV` — visible only in dev, never in production builds.

## Study.jsx

**Cards are sorted oldest-first** (`created_at ASC`) — chronological order of addition. Opposite of Week.jsx.

**All navigation goes through `goTo(index)`** — resets `flipped`, `speakingKey`, and calls `cancelSpeech()`. Three input methods (swipe, keyboard, scrubber) all call `goTo`. Any new navigation method must too.

**Grid view and card view share `index` state.** Grid click calls `goTo(i)` then `setGridView(false)`.

## LotusQuest.jsx

16-bit pixel game hub. Receives `weekId` and `onNavigate` props.

**Phase machine:** `'hub' → 'word-warrior' | 'chunk-builder' → 'score' → 'hub'`

Loads `cards` (for the given `weekId`) and `game_stats` from Supabase on mount. On mode completion, `handleModeComplete(result)` upserts `game_stats` (Supabase) and updates mastery (localStorage via `mastery.js`).

**Mode availability:**
- Word Warrior — enabled if `cards.length > 0`
- Chunk Builder — enabled if any card has `breakdown?.length > 0`

**Pixel theme:** Container applies `.pixel-mode` class, which sets dark background, pixel fonts, and `image-rendering: pixelated`.

## Quiz.jsx

Phase machine: `phase` state cycles `'pick' → 'playing' → 'score'`. Single page — no separate QuizScore route. Navigation: `Week → Quiz (pick) → Quiz (playing) → Quiz (score) → Week or pick`.

**`onDone` contract:** all child quiz components call `onDone({ score, total, results })` where `results` is a `Map<cardId, boolean>`. Quiz.jsx handles mastery writes and XP in `handleDone`.

**Mastery state** (`masteryData`) is loaded once on mount from `loadMastery()` and updated in `handleDone` after each quiz. XP is written via `addXP()` (side-effect, not stored in component state).

**Weighted sampling:** `weightedSample(cards, n, masteryData)` is called at play-phase entry. Missed cards (streak < 3 && incorrect > 0) get 2x weight. For `tiles` mode, cards are pre-filtered to multi-word only (`split(/\s+/).length >= 2`).

**Score screen:** XP bar animates from 0 to `totalXP / 50 * 100`% via double-rAF trick after phase transitions to `'score'`. Missed-cards list scrolls within `max-h-64`. Breakdown toggle shows `<BreakdownDisplay>` inline — no navigation.
