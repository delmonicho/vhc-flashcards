import { useState, useMemo } from 'react'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function wordCount(str) {
  return str.trim().split(/\s+/).length
}

// Builds a pool of pair items with uniform length.
// Prefers single-vocab cards (≤2 words); substitutes long cards with their
// short breakdown chunks when the deck doesn't have enough short cards.
function buildPairPool(sampledCards, allCards) {
  const SHORT_WC = 2
  const allShort = allCards.filter(c => wordCount(c.vietnamese) <= SHORT_WC)

  if (allShort.length >= 4) {
    // Enough short cards in the deck: prefer them, mastery-sampled short ones first
    const sampledShortIds = new Set(
      sampledCards.filter(c => wordCount(c.vietnamese) <= SHORT_WC).map(c => c.id)
    )
    const pool = sampledCards.filter(c => sampledShortIds.has(c.id))
    if (pool.length < sampledCards.length) {
      for (const c of shuffle(allShort.filter(c => !sampledShortIds.has(c.id)))) {
        if (pool.length >= sampledCards.length) break
        pool.push(c)
      }
    }
    return pool.map(c => ({ id: c.id, vi: c.vietnamese, en: c.english, isReal: true }))
  }

  // Not enough short cards: replace long cards with a short breakdown chunk if available
  return sampledCards.map(c => {
    if (wordCount(c.vietnamese) <= SHORT_WC) {
      return { id: c.id, vi: c.vietnamese, en: c.english, isReal: true }
    }
    if (Array.isArray(c.breakdown) && c.breakdown.length > 0) {
      const shortChunks = c.breakdown
        .map((ch, i) => ({ ...ch, origIdx: i }))
        .filter(ch => ch.vi && ch.en && wordCount(ch.vi) <= SHORT_WC)
      if (shortChunks.length > 0) {
        const ch = shortChunks[Math.floor(Math.random() * shortChunks.length)]
        return { id: `_chunk_${c.id}_${ch.origIdx}`, vi: ch.vi, en: ch.en, isReal: false }
      }
    }
    // No short chunks: keep the full card as-is
    return { id: c.id, vi: c.vietnamese, en: c.english, isReal: true }
  })
}

export default function PairMatch({ cards, allPairCards, onDone }) {
  const pool = useMemo(() => buildPairPool(cards, allPairCards ?? cards), [cards, allPairCards])
  const [leftItems] = useState(() => shuffle(pool.map(p => ({ id: p.id, text: p.vi }))))
  const [rightItems] = useState(() => shuffle(pool.map(p => ({ id: p.id, text: p.en }))))
  const [selectedLeft, setSelectedLeft] = useState(null)
  const [selectedRight, setSelectedRight] = useState(null)
  const [matched, setMatched] = useState(() => new Set())
  const [wrong, setWrong] = useState(() => new Set())
  const [firstAttemptFailed] = useState(() => new Set())
  const [results] = useState(() => new Map())

  const total = pool.length

  function handleLeft(id) {
    if (matched.has(id) || wrong.size > 0) return
    const newSelected = selectedLeft === id ? null : id
    setSelectedLeft(newSelected)
    if (newSelected !== null && selectedRight !== null) {
      checkMatch(newSelected, selectedRight)
    }
  }

  function handleRight(id) {
    if (matched.has(id) || wrong.size > 0) return
    const newSelected = selectedRight === id ? null : id
    setSelectedRight(newSelected)
    if (selectedLeft !== null && newSelected !== null) {
      checkMatch(selectedLeft, newSelected)
    }
  }

  function checkMatch(leftId, rightId) {
    if (leftId === rightId) {
      results.set(leftId, !firstAttemptFailed.has(leftId))
      const newMatched = new Set([...matched, leftId])
      setMatched(newMatched)
      setSelectedLeft(null)
      setSelectedRight(null)
      if (newMatched.size === total) {
        setTimeout(() => {
          // Filter synthetic chunk IDs — only real card IDs go to mastery/Supabase
          const realResults = new Map([...results].filter(([id]) => !id.startsWith('_chunk_')))
          const score = [...realResults.values()].filter(Boolean).length
          onDone({ score, total: realResults.size, results: realResults })
        }, 400)
      }
    } else {
      firstAttemptFailed.add(leftId)
      setWrong(new Set([leftId, rightId]))
      setTimeout(() => {
        setWrong(new Set())
        setSelectedLeft(null)
        setSelectedRight(null)
      }, 600)
    }
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-co-border dark:bg-gray-700 rounded-full h-1.5">
          <div
            className="bg-co-primary h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${(matched.size / total) * 100}%` }}
          />
        </div>
        <span className="text-xs text-co-muted dark:text-gray-400 tabular-nums">{matched.size} / {total}</span>
      </div>

      <div className="text-xs font-semibold text-co-muted dark:text-gray-400 uppercase tracking-widest text-center">
        Tap a pair to match
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Left — Vietnamese */}
        <div className="space-y-2">
          {leftItems.map(item => {
            const isMatched = matched.has(item.id)
            const isSelected = selectedLeft === item.id
            const isWrong = wrong.has(item.id)
            return (
              <button
                key={item.id}
                onClick={() => handleLeft(item.id)}
                disabled={isMatched}
                lang="vi"
                className={`w-full text-left px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-1 ${
                  isMatched
                    ? 'bg-green-100 dark:bg-green-900/30 border-2 border-co-fern text-co-fern dark:text-green-400 opacity-60 cursor-default'
                    : isWrong
                    ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-400 text-red-600 dark:text-red-400 shake cursor-pointer'
                    : isSelected
                    ? 'bg-co-primary text-white border-2 border-co-primary shadow-md cursor-pointer'
                    : 'bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-700 text-co-ink dark:text-gray-100 hover:border-co-primary cursor-pointer'
                }`}
              >
                {item.text}
              </button>
            )
          })}
        </div>

        {/* Right — English */}
        <div className="space-y-2">
          {rightItems.map(item => {
            const isMatched = matched.has(item.id)
            const isSelected = selectedRight === item.id
            const isWrong = wrong.has(item.id)
            return (
              <button
                key={item.id}
                onClick={() => handleRight(item.id)}
                disabled={isMatched}
                className={`w-full text-left px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-1 ${
                  isMatched
                    ? 'bg-green-100 dark:bg-green-900/30 border-2 border-co-fern text-co-fern dark:text-green-400 opacity-60 cursor-default'
                    : isWrong
                    ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-400 text-red-600 dark:text-red-400 shake cursor-pointer'
                    : isSelected
                    ? 'bg-co-primary text-white border-2 border-co-primary shadow-md cursor-pointer'
                    : 'bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-700 text-co-ink dark:text-gray-100 hover:border-co-primary cursor-pointer'
                }`}
              >
                {item.text}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
