# Word Warrior UI Improvements

## Overview
Polish the Word Warrior game screen to feel like a proper 16-bit arcade. Four files change.

---

## 1. `src/index.css`

- Add `font-family: var(--font-pixel-ui)` inside `.pixel-mode` as default base font
- Add `.pixel-mode::before` CRT dot texture: `radial-gradient` 1px dots every 8px at 3% white opacity, `z-index: 9999`, `pointer-events: none`, `position: fixed`
- Add `@keyframes pixel-blink` (50% duty cycle, step-start) + `.pixel-blink` class
- Add `@keyframes lotus-sway` (translateX 0 → 2px → 0, 2.7s) + `.lotus-sway` class
- Add `.pixel-blink, .lotus-sway` to existing `prefers-reduced-motion` block

---

## 2. `src/components/game/sprites/LotusSpirit.jsx`

- Wrap existing `<g className={cls}>` in outer `<g className="lotus-sway">` — prevents float (translateY) and sway (translateX) from overriding each other
- Add two side petals: `8×16` rects at `(4,40)` and `(68,40)`, fill `#f4a8c8`
- Add five-dot gold crown arc above head (`4×4` rects in `#ffd000`):
  - `(22,12)` `(30,8)` `(38,4)` `(46,8)` `(54,12)`
- Crown + side petals go inside `.lotus-sway` but **outside** the inner float/flash `<g>`

---

## 3. `src/components/game/WordWarrior.jsx`

### New import
```js
import { speakVietnamese } from '../../lib/speak'
```

### New prop
```js
export default function WordWarrior({ flashcards, onComplete, weekTitle })
```

### New state
```js
const [flipStep, setFlipStep] = useState('idle') // 'idle' | 'out' | 'mid' | 'in'
```

### Modified `handleFlip` — 3D card flip sequence
```js
function handleFlip() {
  setFlipStep('out')
  setTimeout(() => {
    playFlip()
    setPhase('flipped')
    setFlipStep('mid')
    requestAnimationFrame(() => {
      setFlipStep('in')
      setTimeout(() => setFlipStep('idle'), 150)
    })
  }, 150)
}
```

Derive transform + transition from `flipStep`:
```js
const flipTransform =
  flipStep === 'out' ? 'rotateY(-90deg)' :
  flipStep === 'mid' ? 'rotateY(90deg)' : 'rotateY(0deg)'
const flipTransition = (flipStep === 'idle' || flipStep === 'mid') ? 'none' : 'transform 150ms ease-in'
```

### Header (replace existing header div)
```jsx
<>
  <div className="font-pixel-ui text-[10px] text-[#ffd000] text-center border border-[#333] py-1 px-3 mb-1 truncate">
    ▸ {weekTitle?.toUpperCase() ?? 'LOTUS QUEST'}
  </div>
  <div className="flex items-center justify-between">
    <div className="flex gap-1 text-xl">
      {[...Array(5)].map((_, i) => <span key={i}>{i < lives ? '❤' : '🖤'}</span>)}
    </div>
    <div className="font-pixel-score text-[#F5A623] text-xs">+{sessionXP} XP</div>
  </div>
</>
```

### Card area — wrap in perspective + flip div
```jsx
<div style={{ perspective: '600px' }}>
  <div style={{ transform: flipTransform, transition: flipTransition }}>
    {/* LotusSpirit + Vietnamese phrase (phase card) */}
    {/* English + buttons (phase flipped) */}
  </div>
</div>
```

### Vietnamese phrase (replace bare text node)
```jsx
<div className="flex items-center gap-3">
  <div className="pixel-border bg-[#1a0818] px-4 py-3 text-center"
    style={{ borderColor: '#3a1228', fontFamily: 'var(--font-pixel-viet)', fontSize: 'clamp(20px,4vw,32px)' }}>
    {currentCard?.vietnamese}
  </div>
  <button onClick={() => speakVietnamese(currentCard?.vietnamese)}
    className="text-xl opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
    aria-label="Pronounce">🔊</button>
</div>
```

### TAP TO REVEAL
```jsx
<div className="font-pixel-ui text-[10px] text-[#ffd000] pixel-blink">TAP TO REVEAL</div>
```

### English reveal box
```jsx
<div className="pixel-border bg-[#1a2040] px-6 py-4 text-center leading-relaxed text-[#e0e0e0] w-full"
  style={{ fontFamily: 'var(--font-pixel-viet)', fontSize: 'clamp(16px,3vw,24px)', opacity: 0.85 }}>
  {currentCard?.english}
</div>
```

### Action buttons — min-h-[56px], updated colors
```
GOT IT:  bg-[#1a5028]  text-[#5BAF7A]  pixel-border-green  hover:bg-[#1f6030]
REVIEW:  bg-[#1a2840]  text-[#6090d0]  borderColor:#1A5F8A  hover:bg-[#1e3050]
Both:    font-pixel-ui  min-h-[56px]  active:scale-95  disabled:opacity-50
```

### Victory screen
- `"VICTORY!"` → `"STAGE CLEAR!"` — `font-pixel-ui font-bold text-[#ffd000]` at `clamp(24px,5vw,40px)`
- Fireworks: add `style={{ animationIterationCount: 3 }}` to each `.pixel-firework` span
- Stats: numbers use `font-pixel-score`, labels use `font-pixel-ui`

---

## 4. `src/pages/LotusQuest.jsx`

Pass `weekTitle` to `<WordWarrior>`:
```jsx
<WordWarrior
  flashcards={cards}
  weekTitle={week?.title}
  onComplete={...}
/>
```

---

## Verification
1. `npm run dev` — no console errors
2. Gold week banner shows at top of Word Warrior
3. Tap card → Vietnamese slides left, English flips in from right (3D)
4. 🔊 button pronounces the Vietnamese phrase
5. "TAP TO REVEAL" blinks gold; hides after flip
6. `+N XP` session counter increments on each GOT IT
7. GOT IT/REVIEW ≥56px tall with correct colors
8. LotusSpirit: side petals, gold crown arc, subtle X sway independent of Y float
9. Victory: "STAGE CLEAR!" gold, fireworks run 3× then stop
10. CRT dot overlay visible on dark background
11. `prefers-reduced-motion`: blink + sway disabled
