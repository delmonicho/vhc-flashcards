import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ThemeToggle from '../components/ThemeToggle'
import BreakdownDisplay from '../components/BreakdownDisplay'

export default function Study({ weekId, onNavigate, dark, onToggleDark }) {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    supabase
      .from('flashcards')
      .select('*')
      .eq('week_id', weekId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setCards(data || [])
        setLoading(false)
      })
  }, [weekId])

  function goTo(newIndex) {
    setIndex(newIndex)
    setFlipped(false)
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center text-gray-500 dark:text-gray-400 py-12">
        Loading…
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center py-12 space-y-4">
        <p className="text-gray-500 dark:text-gray-400">No cards to study yet.</p>
        <button
          onClick={() => onNavigate('week', weekId)}
          className="text-blue-600 dark:text-blue-400 font-medium"
        >
          ← Back to week
        </button>
      </div>
    )
  }

  const card = cards[index]
  const progress = (index + 1) / cards.length

  return (
    <div className="max-w-lg mx-auto p-6">
      {/* Header + progress */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => onNavigate('week', weekId)}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-2xl leading-none"
          aria-label="Back to week"
        >
          ←
        </button>
        <div className="flex-1">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1.5">
            {index + 1} / {cards.length}
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
        <ThemeToggle dark={dark} onToggle={onToggleDark} />
      </div>

      {/* Flashcard — tap to toggle translation */}
      <div
        onClick={() => setFlipped(f => !f)}
        className="w-full rounded-2xl border-2 flex flex-col items-start p-8 transition-colors bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 active:bg-gray-50 dark:active:bg-gray-800 cursor-pointer"
        style={{ minHeight: '14rem' }}
      >
        <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4 w-full text-center">
          {card.vietnamese}
        </div>
        {flipped ? (
          <>
            <div className="text-lg text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700 pt-4 w-full text-center">
              {card.english}
            </div>
            {card.breakdown && (
              <div className="w-full" onClick={e => e.stopPropagation()}>
                <BreakdownDisplay breakdown={card.breakdown} />
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-gray-400 dark:text-gray-600 w-full text-center">
            tap to reveal
          </div>
        )}
      </div>

      {/* Navigation arrows */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="w-14 h-14 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-30 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-900 dark:hover:text-gray-200 active:bg-gray-50 dark:active:bg-gray-800 transition-colors text-2xl"
          aria-label="Previous card"
        >
          ‹
        </button>
        <button
          onClick={() => goTo(index + 1)}
          disabled={index === cards.length - 1}
          className="w-14 h-14 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-30 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-900 dark:hover:text-gray-200 active:bg-gray-50 dark:active:bg-gray-800 transition-colors text-2xl"
          aria-label="Next card"
        >
          ›
        </button>
      </div>
    </div>
  )
}
