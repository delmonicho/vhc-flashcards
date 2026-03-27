# src/components

Shared UI components. Most are presentational; CardEditModal has complex lifecycle
contracts with its parents.

## CardEditModal

**Props (all required except `onBreakdownReady`):**
- `triggerRef` — ref of the element that opened the modal; focus is restored to it on close. Always pass `lastClickedRef` from the parent.
- `onBreakdownReady(cardId, breakdown)` — called async after save when Vietnamese changed and a new breakdown was generated. Update parent `cards` state here; do NOT await it synchronously.
- `onSave(updatedCard)` — receives the full updated card including `breakdown: null` if Vietnamese text changed.

**Breakdown wipe rule:** If `vietnamese !== card.vietnamese` at save time, `breakdown` is set to `null` in the DB update and re-queued via `getOrCreateBreakdown()` in the background. Never preserve the old breakdown on Vietnamese text change — it silently shows stale data.

**Focus trap is intentionally hand-rolled.** Tab/Shift+Tab is handled manually on the modal's container ref. Do not replace with a focus-trap library — cleanup restores focus to `triggerRef?.current` on unmount. No auto-close on Escape by design (prevents accidental dismissal of edits).

## BreakdownDisplay

**Color alignment constraint:** The vi and en pill rows are two separate `flex-wrap` rows. They stay aligned because `CHUNK_COLORS` is indexed `[i % CHUNK_COLORS.length]` identically in both rows. If you filter or sort either row independently, alignment breaks.

**`inverted` prop:** Pass `inverted={true}` on dark card backgrounds. Switches to `white/` opacity variants instead of `co-` tokens. Returns `null` when `breakdown` is falsy — callers don't need to guard.

## VocabInput

**State machine:** `state` cycles `'idle' → 'loading' → 'preview' → 'error'`. Input is hidden during `'preview'` by design — forces confirm/cancel before adding another card. Never show input and preview simultaneously.

**`source` holds a category id, not a label.** It maps to `flashcards.source` in the DB. The DB has no enum constraint (dropped in migration `20260326044509`), so any string is valid; categories in localStorage are the source of truth.

**Translation preview fields are editable.** Both vi/en fields in preview state are inputs, not display text. Preserve this editability.

## ThemeToggle / Logo

Both are pure presentational. ThemeToggle does NOT read localStorage — all persistence is in App.jsx. `Logo.old.jsx` is kept as reference; do not delete it.

## Quiz components (`src/components/quiz/`)

All four components share the same `onDone({ score, total, results })` contract. `results` is a `Map<cardId, boolean>` — mutated in place via `useState(() => new Map())`, never replaced.

**MultipleChoice** — receives `cards` (sampled) and `allCards` (full week list for distractor pool). Shows Vietnamese prompt, 4 English options. Distractors are random from `allCards` excluding the current card. Advances on answer, shows correct/incorrect colors before "Next" button appears.

**QuickFire** — self-assessment flashcard. Tap to flip, then rate Missed/Got it. No timer.

**PairMatch** — capped at 8 pairs (`cards.slice(0, 8)`). Two-column layout: Vietnamese left, English right (both shuffled independently). Tap one from each column; correct = green + remove, wrong = red shake + reset selection. Tracks `firstAttemptFailed` set — a card is `true` in results only if matched on first try with no prior wrong selection of that left item.

**TileAssembly** — tiles are `{ id: originalIndex, word: string }` to handle duplicate words. Per-card 60s timer via `setInterval` with `[index]` dependency (resets on advance). Timer bar is a CSS `.timer-bar` animation, keyed on `index` to restart. Wrong answer: shake + reset bank to full shuffled set. After 2 wrong attempts, "Show answer" link appears. Correct on first attempt = `true`; any prior wrong = `false`. Timer expiry ends the whole quiz (marks remaining cards false).
