import { useState } from 'react'

export default function QuickFire({ cards, onDone }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results] = useState(() => new Map())

  const card = cards[index]

  function handleRate(wasCorrect) {
    results.set(card.id, wasCorrect)
    const next = index + 1
    if (next >= cards.length) {
      const score = [...results.values()].filter(Boolean).length
      onDone({ score, total: cards.length, results })
      return
    }
    setIndex(next)
    setFlipped(false)
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-co-border dark:bg-gray-700 rounded-full h-1.5">
          <div
            className="bg-co-primary h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${(index / cards.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-co-muted dark:text-gray-400 tabular-nums">{index + 1} / {cards.length}</span>
      </div>

      {/* Card */}
      <button
        onClick={() => !flipped && setFlipped(true)}
        disabled={flipped}
        className={`w-full min-h-52 bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-700 rounded-2xl p-6 text-center transition-all duration-150 ${
          !flipped ? 'hover:border-co-primary hover:shadow-md active:scale-[0.98] cursor-pointer' : 'cursor-default'
        } focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2`}
        aria-label={flipped ? undefined : 'Tap to reveal answer'}
      >
        <div className="text-xs font-semibold text-co-muted dark:text-gray-400 uppercase tracking-widest mb-3">Vietnamese</div>
        <div lang="vi" className="font-display text-3xl font-bold text-co-ink dark:text-gray-100 mb-4">{card.vietnamese}</div>
        {flipped ? (
          <div className="text-co-muted dark:text-gray-300 text-lg pop-in">{card.english}</div>
        ) : (
          <div className="text-co-muted dark:text-gray-500 text-sm mt-2">Tap to reveal</div>
        )}
      </button>

      {flipped && (
        <div className="flex gap-3">
          <button
            onClick={() => handleRate(false)}
            className="flex-1 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 py-3 rounded-2xl font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 cursor-pointer"
          >
            Missed
          </button>
          <button
            onClick={() => handleRate(true)}
            className="flex-1 bg-green-50 dark:bg-green-900/20 border-2 border-co-fern dark:border-green-600 text-co-fern dark:text-green-400 py-3 rounded-2xl font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-co-fern focus:ring-offset-2 cursor-pointer"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  )
}
