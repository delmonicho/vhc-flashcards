# Quiz Mode Improvements Plan

## Context
The approved QUIZ.md plan adds three quiz types (Multiple Choice, Pair Match, Quick Fire) but has key gaps: scores aren't persisted, there's no feedback on which cards keep getting missed, no reason to return daily, and all quiz modes are recognition-only (no active production). Three expert gamification judges evaluated proposed fixes; this plan incorporates their verdicts.

**Judge scores:** Mastery Tracking 8/10 ✅ | Weekly XP Bar 4/10 (modified to 6/10) ⚠️ | Typing Blitz 5/10 → Tile Assembly variant instead ✅

---

## What We're Building

### A. Mastery Tracking + Weak Card Spotlight (Priority 1)
Persist per-card quiz outcomes in localStorage. Score screen shows missed cards with inline breakdown. Future quiz draws weight missed cards 2x until mastered (3 consecutive correct resets weight).

### B. Weekly XP Bar (Modified — no streak) (Priority 2)
Clean weekly XP bar on the score screen. Resets Monday. No daily streak (can't trigger loss aversion without push notifications). Quick Fire = 1pt (not 0.5 — judge noted penalizing self-assessment is backwards).

### C. Tile-Based Word Assembly — "Word Builder" (Priority 3)
4th quiz type: show English, tap Vietnamese word tiles to assemble the answer. 60-second timer. Tone-sensitive exact matching (no fuzzy — tones are semantically meaningful in Vietnamese). Replaces the free-typing Blitz idea, which was killed by the mobile keyboard problem.

---

## Implementation Sequence

Build in this order to stay unblocked:
1. `src/lib/mastery.js` — pure functions, no UI
2. CSS additions to `src/index.css`
3. `src/pages/Quiz.jsx` shell → wired into `App.jsx` + `Week.jsx`
4. `src/components/quiz/MultipleChoice.jsx`
5. `src/components/quiz/QuickFire.jsx`
6. `src/components/quiz/PairMatch.jsx`
7. Score screen body (missed cards + breakdown + XP bar)
8. `src/components/quiz/TileAssembly.jsx`

---

## New File: `src/lib/mastery.js`

**localStorage keys:** `'quiz-mastery'` and `'quiz-xp'`

**Mastery schema:**
```js
// 'quiz-mastery'
{ "card-uuid": { correct: 5, incorrect: 2, streak: 3, lastSeen: 1714000000000 } }
```

**Functions to export:**
- `loadMastery()` / `saveMastery(data)`
- `recordResult(cardId, wasCorrect, store)` — mutates store in place; increments correct/incorrect, updates streak (reset on wrong, increment on right), sets lastSeen
- `getWeight(cardId, store)` — returns `2` if `streak < 3 && incorrect > 0`, else `1`. This is the decay: 3 consecutive correct = back to 1x weight.
- `weightedSample(cards, n, store)` — cards with weight=2 appear twice in pool before sampling; Fisher-Yates shuffle; deduplicates
- `getMissedCards(cards, resultsMap)` — filters to cards where `results.get(id) === false`

**XP schema:**
```js
// 'quiz-xp'
{ weekStart: 1714000000000, xp: 42 }
```

**XP functions:**
- `getWeekStart()` — Monday 00:00:00 UTC of current week
- `loadXP()` — auto-resets if `weekStart` differs from current week
- `addXP(amount)` — loads, adds, saves, returns new total
- `XP_RATES = { mc: 1, match: 2, quickfire: 1, tiles: 1.5 }`

---

## Modified File: `src/pages/Quiz.jsx`

**Expanded state:**
```js
const [phase, setPhase] = useState('pick')        // 'pick' | 'playing' | 'score'
const [quizType, setQuizType] = useState(null)    // 'mc' | 'match' | 'quickfire' | 'tiles'
const [cards, setCards] = useState([])
const [loading, setLoading] = useState(true)
const [result, setResult] = useState(null)        // { score, total, results, xpEarned, totalXP }
const [masteryData, setMasteryData] = useState(() => loadMastery())
const [expandedCardId, setExpandedCardId] = useState(null)
const [speakingKey, setSpeakingKey] = useState(null)
```

**`onDone` contract (expanded from QUIZ.md):**
```js
onDone({ score, total, results })  // results: Map<cardId, boolean>
```

All child components accumulate a `results` Map during play and pass it in `onDone`.

**`handleDone` in Quiz.jsx:**
```js
function handleDone({ score, total, results }) {
  const updated = { ...masteryData }
  for (const [cardId, wasCorrect] of results) {
    recordResult(cardId, wasCorrect, updated)
  }
  saveMastery(updated)
  setMasteryData(updated)
  const xpEarned = Math.round(score * XP_RATES[quizType])
  const totalXP = addXP(xpEarned)
  setResult({ score, total, results, xpEarned, totalXP })
  setPhase('score')
}
```

**Score screen additions:**

1. **XP bar** (above "Cards to Review"):
   - `+N XP` label in `text-co-gold font-semibold text-sm`
   - Progress bar: `bg-co-border h-2 rounded-full` container; `bg-co-gold h-2 rounded-full transition-all duration-700` fill; clamped at 50 XP visually
   - Animate width from 0 to final value via `useEffect` after mount

2. **"Cards to Review" section** (only if `missedCards.length > 0`):
   ```js
   const missedCards = cards.filter(c => result.results?.get(c.id) === false)
   ```
   - Section header: `text-xs font-semibold text-co-muted uppercase tracking-widest`
   - Each row: `bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-700 rounded-2xl p-4`
   - Vietnamese text: `font-display font-semibold text-co-ink dark:text-gray-100`
   - Toggle chevron: rotates 180deg when expanded (`transition-transform`)
   - When expanded: render `<BreakdownDisplay>` inline — **not a navigation**, stays on score screen
   - Wrap missed-cards list in `overflow-y-auto max-h-64` to prevent unbounded height on mobile
   - TTS speak button uses synchronous `speakVietnamese` in onClick (iOS requires user gesture)

---

## New Component: `src/components/quiz/TileAssembly.jsx`

**Mechanic:**
- Show English at top
- Vietnamese tiles (split by space) shuffled in a "bank" row at bottom
- Tap bank tile → moves to answer area; tap answer tile → returns to bank
- "Check" button appears when answer area tile count matches correct word count
- Correct: tiles flash green, advance to next card
- Wrong: tiles shake, answer area resets; after 2 attempts show "Show answer" link
- Correct on 1st attempt = `true` in results Map; 2nd attempt or shown = `false`

**Timer:**
```js
const [secondsLeft, setSecondsLeft] = useState(60)
useEffect(() => {
  setSecondsLeft(60)
  const interval = setInterval(() => {
    setSecondsLeft(s => {
      if (s <= 1) { clearInterval(interval); handleTimeUp(); return 0 }
      return s - 1
    })
  }, 1000)
  return () => clearInterval(interval)
}, [index])
```

**Timer drain bar:** CSS animation class `.timer-bar` (60s linear drain), paused via `.paused` class during correct-flash delay.

**Tile deduplication:** tiles get `{ id: originalIndex, word: string }` to handle duplicate words like "rất rất tốt".

**Card pool filter:** only cards where `card.vietnamese.trim().split(/\s+/).length >= 2` (single-word cards are trivial for this mode). Minimum 2 cards required.

**Picker entry:**
- Type: `'tiles'`, Title: "Word Builder"
- Description: "Arrange Vietnamese tiles to match the English. 60-second timer."

---

## Modified File: `src/index.css`

Add to existing CSS (alongside keyframes called for in QUIZ.md):
```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-6px); }
  40%       { transform: translateX(6px); }
  60%       { transform: translateX(-4px); }
  80%       { transform: translateX(4px); }
}
.shake { animation: shake 0.35s ease-in-out forwards; }

@keyframes pop-in {
  0%   { transform: scale(0.8); opacity: 0.6; }
  60%  { transform: scale(1.05); }
  100% { transform: scale(1);    opacity: 1; }
}
.pop-in { animation: pop-in 0.2s ease-out forwards; }

@keyframes tile-correct {
  0%, 100% { transform: scale(1); }
  40%       { transform: scale(1.08); }
}
.tile-correct { animation: tile-correct 0.25s ease-out forwards; }

@keyframes timer-drain {
  from { width: 100%; }
  to   { width: 0%; }
}
.timer-bar { animation: timer-drain 60s linear forwards; }
.timer-bar.paused { animation-play-state: paused; }

@media (prefers-reduced-motion: reduce) {
  .shake, .pop-in, .tile-correct, .timer-bar {
    animation: none; opacity: 1; transform: none;
  }
}
```

---

## File Manifest

| File | Action |
|---|---|
| `src/lib/mastery.js` | **Create** — mastery + XP localStorage logic |
| `src/pages/Quiz.jsx` | **Create** — phase machine + score screen with missed cards + XP bar |
| `src/components/quiz/MultipleChoice.jsx` | **Create** — add `results` Map to `onDone` |
| `src/components/quiz/QuickFire.jsx` | **Create** — add `results` Map to `onDone` |
| `src/components/quiz/PairMatch.jsx` | **Create** — add `results` Map to `onDone` |
| `src/components/quiz/TileAssembly.jsx` | **Create** — tile bank + 60s timer + tone-exact match |
| `src/App.jsx` | **Modify** — add `'quiz'` case, import Quiz |
| `src/pages/Week.jsx` | **Modify** — add "Quiz" button next to "Study" |
| `src/index.css` | **Modify** — add shake, pop-in, tile-correct, timer-drain + reduced-motion |

**Reuse:** `src/components/BreakdownDisplay.jsx` (existing) — used as-is in score screen missed-card expansion.

---

## Verification

1. `npm run build` — zero errors
2. **Mastery:** Complete a quiz with some wrong answers → "Cards to Review" appears on score screen → tap a card → breakdown expands inline (no navigation) → re-run quiz → missed cards appear more frequently
3. **Decay:** Answer a previously-missed card correctly 3 sessions in a row → `getWeight` returns 1 (verify in console)
4. **XP bar:** Score screen shows `+N XP` and animated bar fill; reload next Monday → bar resets
5. **Word Builder:** 4th option in picker → English shown, tiles shuffled → assemble correct answer → green flash + advance → wrong assembly shakes → timer drains to 0 → quiz ends
6. **Tone matching:** Typing "xin chao" (no tones) as tiles does not match "xin chào" — must select correct toned tiles
7. **Dark mode:** All new UI respects `dark:` variants
8. **Reduced motion:** Animations suppressed when `prefers-reduced-motion: reduce`
9. **Score screen height:** Expand 3+ missed-card breakdowns → list scrolls within `max-h-64` container, page does not grow unbounded
