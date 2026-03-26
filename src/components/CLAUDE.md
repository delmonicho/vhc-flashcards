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

## Upcoming: Quiz components

`QuizScore.jsx` will be added here. See `QUIZ.md` at the root for the full spec.
