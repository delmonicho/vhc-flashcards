# Plan: Quiz Mode — 3 Quiz Types for Cô Ơi

## Context
The app has flashcard Study mode but no active recall testing. A Quiz mode gives learners a fun, low-pressure way to check how well vocab is sticking — with immediate feedback, a score, and encouragement. Three quiz formats cover different learning styles: recognition, pattern matching, and honest self-assessment.

---

## Quiz Types

### 1. 🎯 Multiple Choice
Show a Vietnamese card, pick the correct English from 4 options.
- 10 questions drawn randomly from the week's cards (or all if < 10)
- Wrong options = English from other cards in the week (random distractors)
- Immediate color feedback on tap: green ✓ / red ✗, correct answer revealed if wrong
- "Next" button appears after answering; auto-advances after short delay on correct
- Minimum 4 cards required to run

### 2. 🔗 Pair Match
Scrambled two-column layout — tap one Vietnamese and one English to match.
- 6 cards per round (random selection)
- Left column: Vietnamese; right column: English, both shuffled independently
- Correct match: both tiles lock with a colored glow and fade out
- Wrong match: tiles briefly shake, reset selection
- Round complete when all 6 matched; show time taken as bonus stat
- Minimum 4 cards required

### 3. ⚡ Quick Fire
Rapid-fire self-grade — reveal then rate honestly.
- All cards in the week, one per screen
- Front: Vietnamese text; tap anywhere to reveal English
- After reveal: two buttons — "Got it ✓" (green) and "Not yet ✗" (rose)
- Running streak counter shown (resets on miss)
- No pressure — any answer is fine, streak is just for fun

---

## Score Screen (shared)
After any quiz:
- Big score display: e.g. "8 / 10"
- Encouraging message tier based on %:
  - 90–100%: "Xuất sắc! 🌟 You're on fire!"
  - 70–89%: "Rất tốt! 💪 Almost perfect!"
  - 50–69%: "Tốt lắm! 🌸 Keep going!"
  - < 50%: "Cố lên! 🌱 Practice makes perfect!"
- Two buttons: "Play again" (reshuffles, restarts same quiz) and "← Back to week"

---

## Files to create / modify

### New
- `src/pages/Quiz.jsx` — top-level page: quiz picker → active quiz → score screen
- `src/components/quiz/MultipleChoice.jsx`
- `src/components/quiz/PairMatch.jsx`
- `src/components/quiz/QuickFire.jsx`
- `QUIZ.md` — saved to repo root as the README the user requested

### Modified
- `src/App.jsx` — add `'quiz'` case to page switcher, import Quiz
- `src/pages/Week.jsx` — add "Quiz" button in header next to "Study" button

---

## Navigation / data flow
- `onNavigate('quiz', weekId)` launched from Week.jsx header
- Quiz.jsx receives `{ weekId, onNavigate, dark, onToggleDark }` (same pattern as Study.jsx)
- Cards fetched once in Quiz.jsx on mount (same Supabase query as Study.jsx)
- Quiz type selected on a picker screen; active quiz rendered as child component
- Child components receive `cards`, `onDone(score, total)` callback
- `onDone` triggers score screen in Quiz.jsx

---

## Quiz.jsx internal state
```js
const [phase, setPhase]   = useState('pick')   // 'pick' | 'playing' | 'score'
const [quizType, setQuizType] = useState(null) // 'mc' | 'match' | 'quickfire'
const [result, setResult] = useState(null)     // { score, total }
const [cards, setCards]   = useState([])
const [loading, setLoading] = useState(true)
```

---

## CSS additions (`src/index.css`)
- `shake` keyframe animation (horizontal wiggle, 0.35s) — used by PairMatch on wrong match
- `pop-in` keyframe (scale 0.8→1.05→1, 0.2s) — used by correct answer reveals

---

## Verification
1. `npm run build` — zero errors
2. Week page: "Quiz" button appears, disabled when 0 cards
3. Quiz picker: 3 cards shown with title + description
4. Multiple Choice: 4 options appear, correct/wrong feedback works, score tallied
5. Pair Match: tiles match/shake correctly, all 6 cleared = round done
6. Quick Fire: reveal works, Got it/Not yet counted, streak updates
7. Score screen: correct message tier, Play again reshuffles, back returns to week
8. Dark mode: all quiz screens respect dark theme
