import { useState, useMemo } from 'react'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function PairMatch({ cards, onDone }) {
  const pool = useMemo(() => cards.slice(0, 8), [])
  const [leftItems] = useState(() => shuffle(pool.map(c => ({ id: c.id, text: c.vietnamese }))))
  const [rightItems] = useState(() => shuffle(pool.map(c => ({ id: c.id, text: c.english }))))
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
          const score = [...results.values()].filter(Boolean).length
          onDone({ score, total, results })
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
