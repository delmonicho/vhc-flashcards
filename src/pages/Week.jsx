import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { loadCategories, saveCategories, getCategoryColor, deleteCategory } from '../lib/categories'
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
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [categories, setCategories] = useState(() => loadCategories())
  const lastClickedRef = useRef(null)

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

  function handleBreakdownReady(cardId, breakdown) {
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, breakdown } : c))
  }

  function handleModalSave(updatedCard) {
    setCards(prev => prev.map(c => (c.id === updatedCard.id ? updatedCard : c)))
    setEditingCard(null)
  }

  function handleModalDelete(cardId) {
    setCards(prev => prev.filter(c => c.id !== cardId))
    setEditingCard(null)
  }

  function handleCategoriesChange(updated) {
    saveCategories(updated)
    setCategories(updated)
  }

  async function handleDeleteCategory(catId) {
    // 1. Remove from localStorage
    handleCategoriesChange(deleteCategory(categories, catId))
    // 2. Optimistic UI: strip the deleted tag from all local cards
    setCards(prev => prev.map(c => ({
      ...c,
      source: (c.source || []).filter(s => s !== catId),
    })))
    // 3. Persist to DB for affected cards
    const affected = cards.filter(c => (c.source || []).includes(catId))
    await Promise.all(affected.map(card =>
      supabase.from('flashcards')
        .update({ source: (card.source || []).filter(s => s !== catId) })
        .eq('id', card.id)
    ))
    // 4. Reset filter if it pointed at the deleted category
    if (sourceFilter === catId) setSourceFilter('all')
  }

  const learnedCount = cards.filter(c => c.status === 'learned').length
  const learnedPct = cards.length > 0 ? Math.round((learnedCount / cards.length) * 100) : 0

  const filteredCards = cards.filter(card => {
    const tags = card.source || []
    if (sourceFilter === 'uncategorized') return tags.length === 0
    if (sourceFilter !== 'all' && !tags.includes(sourceFilter)) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return card.vietnamese.toLowerCase().includes(q) || card.english.toLowerCase().includes(q)
    }
    return true
  })

  if (loading) {
    return <LoadingDots />
  }

  return (
    <div className="page-fade-in max-w-2xl mx-auto px-4 py-6 md:px-8">
      {/* Skip link */}
      <a
        href="#cards-grid"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-co-primary focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        Skip to cards
      </a>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => onNavigate('home')}
          className="w-11 h-11 flex items-center justify-center rounded-full text-co-muted dark:text-gray-400 hover:text-co-primary hover:bg-co-surface dark:hover:bg-gray-800 transition-all text-xl leading-none focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2"
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
          className="bg-co-fern text-white px-4 py-2 rounded-full font-semibold text-sm disabled:opacity-40 hover:scale-105 active:scale-95 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-co-fern focus:ring-offset-2"
        >
          Study
        </button>
        <button
          onClick={() => onNavigate('quiz', weekId)}
          disabled={cards.length === 0}
          className="bg-co-primary text-white px-4 py-2 rounded-full font-semibold text-sm disabled:opacity-40 hover:scale-105 active:scale-95 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2"
        >
          Quiz
        </button>
        <button
          onClick={() => onNavigate('lotus-quest', weekId)}
          disabled={cards.length === 0}
          className="bg-[#0d1018] text-[#e0e0e0] border-2 border-[#444] px-3 py-2 rounded font-mono text-xs disabled:opacity-40 hover:scale-105 active:scale-95 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2"
          style={{ boxShadow: '2px 2px 0 #000' }}
        >
          ▶ QUEST
        </button>
        <ThemeToggle dark={dark} onToggle={onToggleDark} />
      </div>

      <VocabInput
        weekId={weekId}
        onCardCreated={handleCardCreated}
        onCardBreakdownReady={handleBreakdownReady}
        categories={categories}
        onCategoriesChange={handleCategoriesChange}
      />

      {cards.length > 0 && (
        <div className="mt-4 bg-co-surface dark:bg-gray-800/50 border border-co-border dark:border-gray-700 rounded-2xl p-4 space-y-3">
          <label htmlFor="search-cards" className="sr-only">Search cards</label>
          <input
            id="search-cards"
            type="search"
            placeholder="Search cards…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-co-border dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-co-ink dark:text-gray-100 placeholder-co-muted dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-co-primary"
          />
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs font-semibold text-co-muted dark:text-gray-400 uppercase tracking-widest">Filter:</span>
            {/* All */}
            <button
              onClick={() => setSourceFilter('all')}
              aria-pressed={sourceFilter === 'all'}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-1 ${
                sourceFilter === 'all'
                  ? 'bg-co-primary text-white shadow-sm'
                  : 'bg-white dark:bg-gray-700 text-co-muted dark:text-gray-400 hover:text-co-ink dark:hover:text-gray-200'
              }`}
            >
              All
            </button>
            {/* Named categories with × delete */}
            {categories.map(cat => (
              <div key={cat.id} className="group relative flex items-center">
                <button
                  onClick={() => setSourceFilter(cat.id)}
                  aria-pressed={sourceFilter === cat.id}
                  style={sourceFilter === cat.id ? { backgroundColor: cat.color, color: '#2D1B12' } : {}}
                  className={`pl-4 pr-7 py-2 rounded-full text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-1 ${
                    sourceFilter === cat.id
                      ? 'shadow-sm'
                      : 'bg-white dark:bg-gray-700 text-co-muted dark:text-gray-400 hover:text-co-ink dark:hover:text-gray-200'
                  }`}
                >
                  {cat.label}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleDeleteCategory(cat.id) }}
                  aria-label={`Delete ${cat.label} category`}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-co-muted hover:text-red-500 text-sm leading-none focus:opacity-100 focus:outline-none"
                >
                  ×
                </button>
              </div>
            ))}
            {/* Uncategorized */}
            <button
              onClick={() => setSourceFilter('uncategorized')}
              aria-pressed={sourceFilter === 'uncategorized'}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-1 ${
                sourceFilter === 'uncategorized'
                  ? 'bg-co-ink text-white shadow-sm dark:bg-gray-200 dark:text-gray-900'
                  : 'bg-white dark:bg-gray-700 text-co-muted dark:text-gray-400 hover:text-co-ink dark:hover:text-gray-200'
              }`}
            >
              Untagged
            </button>
          </div>
        </div>
      )}

      {cards.length > 0 && (
        <div className="mt-5" id="cards-grid">
          {/* Progress + count */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <h2
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="text-xs font-semibold text-co-muted dark:text-gray-400 uppercase tracking-widest"
              >
                {learnedCount > 0
                  ? `${learnedCount} / ${cards.length} learned`
                  : `${filteredCards.length}${filteredCards.length !== cards.length ? ` of ${cards.length}` : ''} ${filteredCards.length === 1 ? 'card' : 'cards'}`}
              </h2>
              {learnedCount > 0 && filteredCards.length !== cards.length && (
                <span className="text-xs text-co-muted dark:text-gray-500">
                  showing {filteredCards.length}
                </span>
              )}
            </div>
            {learnedCount > 0 && (
              <div className="w-full bg-co-border dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-co-fern rounded-full h-1.5 transition-all duration-500"
                  style={{ width: `${learnedPct}%` }}
                  role="progressbar"
                  aria-valuenow={learnedCount}
                  aria-valuemin={0}
                  aria-valuemax={cards.length}
                  aria-label={`${learnedCount} of ${cards.length} cards learned`}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredCards.map(card => {
              const cardTags = card.source || []
              return (
                <button
                  key={card.id}
                  aria-label={`${card.vietnamese} — ${card.english}${cardTags.length ? `, ${cardTags.join(', ')}` : ''}`}
                  className={`relative flex flex-col w-full min-h-28 text-left bg-white dark:bg-gray-900 border border-co-border dark:border-gray-700 rounded-2xl p-4 hover:border-co-primary dark:hover:border-co-primary hover:shadow-md transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 ${
                    card.status === 'learned' ? 'border-l-4 border-l-co-fern' :
                    card.status === 'learning' ? 'border-l-4 border-l-co-gold' : ''
                  }`}
                  onClick={e => { lastClickedRef.current = e.currentTarget; setEditingCard(card) }}
                >
                  <div lang="vi" className="flex-1 font-display font-semibold text-co-ink dark:text-gray-100 mb-1.5 line-clamp-3 text-base leading-snug">
                    {card.vietnamese}
                  </div>
                  <div className="text-co-muted dark:text-gray-300 text-sm line-clamp-2 mb-2">
                    {card.english}
                  </div>
                  {cardTags.length > 0 && (
                    <div aria-hidden="true" className="mt-auto flex flex-wrap gap-1">
                      {cardTags.map(tagId => (
                        <span
                          key={tagId}
                          className="text-xs px-2 py-0.5 rounded-full font-semibold leading-tight"
                          style={{ backgroundColor: getCategoryColor(categories, tagId), color: '#2D1B12' }}
                        >
                          {categories.find(c => c.id === tagId)?.label ?? tagId}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
          {filteredCards.length === 0 && (
            <p className="text-center text-co-muted dark:text-gray-500 py-10 text-sm">
              No cards match.
            </p>
          )}
        </div>
      )}

      {editingCard && (
        <CardEditModal
          card={editingCard}
          categories={categories}
          onSave={handleModalSave}
          onDelete={handleModalDelete}
          onClose={() => setEditingCard(null)}
          onBreakdownReady={handleBreakdownReady}
          triggerRef={lastClickedRef}
        />
      )}
    </div>
  )
}
