import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import VocabInput from '../components/VocabInput'
import ThemeToggle from '../components/ThemeToggle'
import CardEditModal from '../components/CardEditModal'

function LoadingDots() {
  return (
    <div className="flex justify-center gap-2 py-16">
      <span className="loading-dot" />
      <span className="loading-dot" />
      <span className="loading-dot" />
    </div>
  )
}

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
    return <LoadingDots />
  }

  return (
    <div className="page-fade-in max-w-2xl mx-auto px-4 py-6 md:px-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => onNavigate('home')}
          className="w-9 h-9 flex items-center justify-center rounded-full text-co-muted dark:text-gray-400 hover:text-co-primary hover:bg-co-surface dark:hover:bg-gray-800 transition-all text-xl leading-none"
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="flex-1 font-display text-2xl font-bold truncate text-co-ink dark:text-gray-100">
          {week?.title}
        </h1>
        <button
          onClick={() => onNavigate('study', weekId)}
          disabled={cards.length === 0}
          className="bg-co-fern text-white px-4 py-2 rounded-full font-semibold text-sm disabled:opacity-40 hover:scale-105 active:scale-95 transition-all duration-150"
        >
          Study
        </button>
        <ThemeToggle dark={dark} onToggle={onToggleDark} />
      </div>

      <VocabInput weekId={weekId} onCardCreated={handleCardCreated} />

      {cards.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xs font-semibold text-co-muted dark:text-gray-400 uppercase tracking-widest mb-3">
            {cards.length} {cards.length === 1 ? 'card' : 'cards'}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {cards.map(card => (
              <button
                key={card.id}
                className="w-full text-left bg-white dark:bg-gray-900 border border-co-border dark:border-gray-700 rounded-2xl p-4 hover:border-co-primary dark:hover:border-co-primary hover:shadow-md transition-all duration-150 active:scale-[0.98]"
                onClick={() => setEditingCard(card)}
              >
                <div className="font-display font-semibold text-co-ink dark:text-gray-100 mb-1 line-clamp-3 text-sm leading-snug">
                  {card.vietnamese}
                </div>
                <div className="text-co-muted dark:text-gray-400 text-xs mb-3 line-clamp-2">
                  {card.english}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-block text-xs px-2.5 py-0.5 rounded-full font-medium ${
                      card.source === 'class'
                        ? 'bg-co-blush text-co-primary'
                        : 'bg-co-cream text-co-gold'
                    }`}
                  >
                    {card.source}
                  </span>
                  {card.breakdown && (
                    <span className="text-xs text-co-muted dark:text-gray-600">
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
