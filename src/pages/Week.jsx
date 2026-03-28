import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getCategoryColor, deleteCategory, upsertCategories, nextColor } from '../lib/categories'
import { logError } from '../lib/logger'
import { stripDiacritics } from '../lib/breakdown'
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

export default function Week({ weekId, onNavigate, dark, onToggleDark, categories, onCategoriesChange }) {
  const [week, setWeek] = useState(null)
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingCard, setEditingCard] = useState(null)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [sourceFilter, setSourceFilter] = useState('all')
  const lastClickedRef = useRef(null)
  const searchInputRef = useRef(null)

  useEffect(() => {
    fetchData()
  }, [weekId])

  async function fetchData() {
    setLoading(true)
    const [{ data: weekData, error: weekError }, { data: cardsData, error: cardsError }] = await Promise.all([
      supabase.from('weeks').select('*').eq('id', weekId).single(),
      supabase
        .from('flashcards')
        .select('*')
        .eq('week_id', weekId)
        .order('created_at', { ascending: false }),
    ])
    if (weekError) logError('Failed to load week', { page: 'week', action: 'fetchData', err: weekError, details: { weekId } })
    if (cardsError) logError('Failed to load cards', { page: 'week', action: 'fetchData', err: cardsError, details: { weekId } })
    setWeek(weekData)
    const loaded = cardsData || []
    setCards(loaded)
    setLoading(false)

    // Reconcile: auto-recover any tag IDs on cards that aren't in the categories list
    const allTagIds = [...new Set(loaded.flatMap(c => c.source || []))]
    const knownIds = new Set(categories.map(c => c.id))
    const orphanIds = allTagIds.filter(id => !knownIds.has(id))
    if (orphanIds.length > 0) {
      const running = [...categories]
      const recovered = orphanIds.map(id => {
        const label = id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        const color = nextColor(running)
        const cat = { id, label, color }
        running.push(cat)
        return cat
      })
      upsertCategories(recovered).catch(err =>
        logError('Failed to upsert recovered categories', { page: 'week', action: 'fetchData', err })
      )
      onCategoriesChange([...categories, ...recovered])
    }
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

  async function handleDeleteCategory(catId) {
    // 1. Optimistic UI: update state immediately
    onCategoriesChange(categories.filter(c => c.id !== catId))
    setCards(prev => prev.map(c => ({
      ...c,
      source: (c.source || []).filter(s => s !== catId),
    })))
    if (sourceFilter === catId) setSourceFilter('all')
    // 2. Persist to Supabase in background
    const affected = cards.filter(c => (c.source || []).includes(catId))
    await Promise.all([
      deleteCategory(categories, catId),
      ...affected.map(card =>
        supabase.from('flashcards')
          .update({ source: (card.source || []).filter(s => s !== catId) })
          .eq('id', card.id)
      ),
    ])
  }

  const learnedCount = cards.filter(c => c.status === 'learned').length
  const learnedPct = cards.length > 0 ? Math.round((learnedCount / cards.length) * 100) : 0

  const filteredCards = cards.filter(card => {
    const tags = card.source || []
    if (sourceFilter === 'untagged') return tags.length === 0
    if (sourceFilter !== 'all' && !tags.includes(sourceFilter)) return false
    if (search.trim()) {
      const q = stripDiacritics(search.trim().toLowerCase())
      return stripDiacritics(card.vietnamese.toLowerCase()).includes(q) ||
             stripDiacritics(card.english.toLowerCase()).includes(q)
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
          className="w-11 h-11 flex items-center justify-center rounded-full text-co-muted dark:text-gray-400 hover:text-co-primary hover:bg-co-surface dark:hover:bg-gray-800 transition-all text-xl leading-none focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 cursor-pointer"
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
          className="bg-co-fern text-white px-4 py-2 rounded-full font-semibold text-sm disabled:opacity-40 hover:scale-105 active:scale-95 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-co-fern focus:ring-offset-2 cursor-pointer"
        >
          Study
        </button>
        <button
          onClick={() => onNavigate('quiz', weekId)}
          disabled={cards.length === 0}
          className="bg-co-primary text-white px-4 py-2 rounded-full font-semibold text-sm disabled:opacity-40 hover:scale-105 active:scale-95 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 cursor-pointer"
        >
          Quiz
        </button>
        <button
          onClick={() => onNavigate('lotus-quest', weekId)}
          disabled={cards.length === 0}
          className="bg-[#0d1018] text-[#e0e0e0] border-2 border-[#444] px-3 py-2 rounded font-mono text-xs disabled:opacity-40 hover:scale-105 active:scale-95 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 cursor-pointer"
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
        onCategoriesChange={onCategoriesChange}
      />

      {cards.length > 0 && (
        <div className="mt-4 bg-co-surface dark:bg-gray-800/50 border border-co-border dark:border-gray-700 rounded-2xl p-4">
          <div role="search" className="flex gap-2 flex-wrap items-center">
            {/* Search icon button + expandable input */}
            <div className="flex items-center">
              <button
                onClick={() => {
                  if (searchOpen) { setSearch(''); setSearchOpen(false) }
                  else { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 0) }
                }}
                aria-label={searchOpen ? 'Close search' : 'Search cards'}
                aria-expanded={searchOpen}
                aria-controls="search-cards"
                className={`w-8 h-8 flex items-center justify-center rounded-full text-co-muted dark:text-gray-400 hover:text-co-primary hover:bg-white dark:hover:bg-gray-700 transition-all cursor-pointer ${searchOpen ? 'text-co-primary' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                  <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                </svg>
              </button>
              {searchOpen && (
                <>
                  <label htmlFor="search-cards" className="sr-only">Search cards</label>
                  <input
                    ref={searchInputRef}
                    id="search-cards"
                    type="search"
                    placeholder="Search…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}

                    onKeyDown={e => { if (e.key === 'Escape') { setSearch(''); setSearchOpen(false); } }}
                    className="w-36 border border-co-border dark:border-gray-600 rounded-xl px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-co-ink dark:text-gray-100 placeholder-co-muted dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-co-primary ml-1"
                  />
                </>
              )}
            </div>
            <span className="text-xs font-semibold text-co-muted dark:text-gray-400 uppercase tracking-widest">Filter:</span>
            {/* All */}
            <button
              onClick={() => setSourceFilter(sourceFilter === 'all' ? 'untagged' : 'all')}
              aria-pressed={sourceFilter === 'all'}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-1 cursor-pointer ${
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
                  className={`pl-4 pr-7 py-2 rounded-full text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-1 cursor-pointer ${
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-co-muted hover:text-red-500 text-sm leading-none focus:opacity-100 focus:outline-none cursor-pointer"
                >
                  ×
                </button>
              </div>
            ))}
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
                  className={`relative flex flex-col w-full min-h-28 text-left bg-white dark:bg-gray-900 border border-co-border dark:border-gray-700 rounded-2xl p-4 hover:border-co-primary dark:hover:border-co-primary hover:shadow-md transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 cursor-pointer ${
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
