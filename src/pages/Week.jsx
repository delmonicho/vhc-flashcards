import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import VocabInput from '../components/VocabInput'
import ThemeToggle from '../components/ThemeToggle'
import CardEditModal from '../components/CardEditModal'

export default function Week({ weekId, onNavigate, dark, onToggleDark }) {
  const [week, setWeek] = useState(null)
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingCard, setEditingCard] = useState(null)

  useEffect(() => {
    fetchData()
  }, [weekId])

  async function fetchData() {
    setLoading(true)
    const [{ data: weekData }, { data: cardsData }] = await Promise.all([
      supabase.from('weeks').select('*').eq('id', weekId).single(),
      supabase
        .from('flashcards')
        .select('*')
        .eq('week_id', weekId)
        .order('created_at', { ascending: false }),
    ])
    setWeek(weekData)
    setCards(cardsData || [])
    setLoading(false)
  }

  function handleCardCreated(newCard) {
    setCards(prev => [newCard, ...prev])
  }

  function handleModalSave(updatedCard) {
    setCards(prev => prev.map(c => (c.id === updatedCard.id ? updatedCard : c)))
    setEditingCard(null)
  }

  function handleModalDelete(cardId) {
    setCards(prev => prev.filter(c => c.id !== cardId))
    setEditingCard(null)
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center text-gray-500 dark:text-gray-400 py-12">
        Loading…
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => onNavigate('home')}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-2xl leading-none"
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="flex-1 text-2xl font-bold truncate text-gray-900 dark:text-gray-100">
          {week?.title}
        </h1>
        <button
          onClick={() => onNavigate('study', weekId)}
          disabled={cards.length === 0}
          className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-40 active:bg-green-700"
        >
          Study
        </button>
        <ThemeToggle dark={dark} onToggle={onToggleDark} />
      </div>

      <VocabInput weekId={weekId} onCardCreated={handleCardCreated} />

      {cards.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            {cards.length} {cards.length === 1 ? 'card' : 'cards'}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {cards.map(card => (
              <button
                key={card.id}
                className="w-full text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 group hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                onClick={() => setEditingCard(card)}
              >
                <div className="font-medium text-gray-900 dark:text-gray-100 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-3">
                  {card.vietnamese}
                </div>
                <div className="text-gray-500 dark:text-gray-400 text-sm mb-3 line-clamp-2">
                  {card.english}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                      card.source === 'class'
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                        : 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300'
                    }`}
                  >
                    {card.source}
                  </span>
                  {card.breakdown && (
                    <span className="text-xs text-gray-400 dark:text-gray-600">
                      {card.breakdown.length} chunks
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {editingCard && (
        <CardEditModal
          card={editingCard}
          onSave={handleModalSave}
          onDelete={handleModalDelete}
          onClose={() => setEditingCard(null)}
        />
      )}
    </div>
  )
}
