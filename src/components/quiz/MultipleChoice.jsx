import { useState } from 'react'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildOptions(card, allCards) {
  const distractors = shuffle(allCards.filter(c => c.id !== card.id)).slice(0, 3)
  return shuffle([card, ...distractors])
}

export default function MultipleChoice({ cards, allCards, onDone }) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [results] = useState(() => new Map())
  const [options, setOptions] = useState(() => buildOptions(cards[0], allCards))

  const card = cards[index]
  const isAnswered = selected !== null

  function handleSelect(option) {
    if (isAnswered) return
    setSelected(option.id)
    results.set(card.id, option.id === card.id)
  }

  function handleNext() {
    const next = index + 1
    if (next >= cards.length) {
      const score = [...results.values()].filter(Boolean).length
      onDone({ score, total: cards.length, results })
      return
    }
    setIndex(next)
    setSelected(null)
    setOptions(buildOptions(cards[next], allCards))
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

      {/* Card prompt */}
      <div className="bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-700 rounded-2xl p-6 text-center">
        <div className="text-xs font-semibold text-co-muted dark:text-gray-400 uppercase tracking-widest mb-3">Vietnamese</div>
        <div lang="vi" className="font-display text-3xl font-bold text-co-ink dark:text-gray-100">{card.vietnamese}</div>
      </div>

      {/* Options */}
      <div className="space-y-3">
        {options.map(option => {
          let cls = 'w-full text-left bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-700 rounded-2xl p-4 font-semibold text-co-ink dark:text-gray-100 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2'
          if (isAnswered) {
            if (option.id === card.id) {
              cls = 'w-full text-left bg-green-50 dark:bg-green-900/20 border-2 border-co-fern rounded-2xl p-4 font-semibold text-co-fern dark:text-green-400 transition-all duration-150 focus:outline-none'
            } else if (option.id === selected) {
              cls = 'w-full text-left bg-red-50 dark:bg-red-900/20 border-2 border-red-400 rounded-2xl p-4 font-semibold text-red-600 dark:text-red-400 transition-all duration-150 focus:outline-none'
            } else {
              cls += ' opacity-40'
            }
          } else {
            cls += ' hover:border-co-primary hover:shadow-md active:scale-[0.98] cursor-pointer'
          }
          return (
            <button key={option.id} onClick={() => handleSelect(option)} className={cls} disabled={isAnswered}>
              {option.english}
            </button>
          )
        })}
      </div>

      {isAnswered && (
        <button
          onClick={handleNext}
          className="w-full bg-co-primary text-white py-3 rounded-2xl font-semibold text-sm hover:scale-[1.01] active:scale-[0.99] transition-all focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 cursor-pointer"
        >
          {index + 1 >= cards.length ? 'See Results' : 'Next →'}
        </button>
      )}
    </div>
  )
}
