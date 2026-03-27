# src/pages

Full-page views rendered by App.jsx. All receive `onNavigate(page, weekId?)`, `dark`, and `onToggleDark` props.

## App.jsx navigation

`view` state is `{ page, weekId }`. Adding a new page requires a new `view.page === 'newpage'` branch in App.jsx. No browser history, no URL routing — every `onNavigate` replaces the current view entirely.

Dark mode: App.jsx owns localStorage persistence. Pages receive `dark` (boolean) as a prop — they do not read storage directly.

## Week.jsx

**Breakdown callback chain:** Two separate async paths both call `handleBreakdownReady(cardId, breakdown)` which does `setCards(prev => prev.map(...))`:
- `onCardBreakdownReady` → from VocabInput after new card creation
- `onBreakdownReady` → from CardEditModal after edit

Any new card creation path (bulk import, etc.) must also wire `handleBreakdownReady`.

**`lastClickedRef` pattern:** Stores the DOM element that opened CardEditModal so focus can return on close. If you add a second trigger for CardEditModal, store its element in the same `lastClickedRef` before calling `setEditingCard`.

**Categories write path:** Always call `saveCategories(updated)` AND `setCategories(updated)` together. Never update one without the other.

**Cards are sorted newest-first** (`created_at DESC`). New cards are prepended via `[newCard, ...prev]`.

## Home.jsx

**Card count fetch** is a full-table scan of `flashcards` (id + week_id only). Fine at current scale.

**Inline edit pattern:** Title editing replaces the title text with an input. Saves on `blur`/`Enter`, cancels on `Escape`. `editInputRef` is focused via `useEffect` when `editingWeekId` changes.

**Delete uses a bottom sheet** (not a modal) for mobile ergonomics. Keep destructive confirmations as bottom sheets on this page.

**Backfill button** is wrapped in `import.meta.env.DEV` — visible only in dev, never in production builds.

## Study.jsx

**Cards are sorted oldest-first** (`created_at ASC`) — chronological order of addition. Opposite of Week.jsx.

**All navigation goes through `goTo(index)`** — resets `flipped`, `speakingKey`, and calls `cancelSpeech()`. Three input methods (swipe, keyboard, scrubber) all call `goTo`. Any new navigation method must too.

**Grid view and card view share `index` state.** Grid click calls `goTo(i)` then `setGridView(false)`.

## Quiz.jsx

Phase machine: `phase` state cycles `'pick' → 'playing' → 'score'`. Single page — no separate QuizScore route. Navigation: `Week → Quiz (pick) → Quiz (playing) → Quiz (score) → Week or pick`.

**`onDone` contract:** all child quiz components call `onDone({ score, total, results })` where `results` is a `Map<cardId, boolean>`. Quiz.jsx handles mastery writes and XP in `handleDone`.

**Mastery state** (`masteryData`) is loaded once on mount from `loadMastery()` and updated in `handleDone` after each quiz. XP is written via `addXP()` (side-effect, not stored in component state).

**Weighted sampling:** `weightedSample(cards, n, masteryData)` is called at play-phase entry. Missed cards (streak < 3 && incorrect > 0) get 2x weight. For `tiles` mode, cards are pre-filtered to multi-word only (`split(/\s+/).length >= 2`).

**Score screen:** XP bar animates from 0 to `totalXP / 50 * 100`% via double-rAF trick after phase transitions to `'score'`. Missed-cards list scrolls within `max-h-64`. Breakdown toggle shows `<BreakdownDisplay>` inline — no navigation.
