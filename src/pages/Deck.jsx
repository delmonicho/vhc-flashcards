import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getCategoryColor, deleteCategory, upsertCategories, nextColor } from '../lib/categories'
import { logError } from '../lib/logger'
import { stripDiacritics, getOrCreateBreakdown, batchGetOrCreateBreakdowns } from '../lib/breakdown'
import { useAuth } from '../context/AuthContext'
import VocabInput from '../components/VocabInput'
import CardEditModal from '../components/CardEditModal'
import PdfImportModal from '../components/PdfImportModal'

function LoadingDots() {
  return (
    <div className="flex justify-center gap-2 py-16">
      <span className="loading-dot" />
      <span className="loading-dot" />
      <span className="loading-dot" />
    </div>
  )
}

export default function Deck({ deckId, onNavigate, categories, onCategoriesChange, justCopied = false }) {
  const { user } = useAuth()
  const [deck, setDeck] = useState(null)
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [copying, setCopying] = useState(false)
  const [copyDone, setCopyDone] = useState(false)
  const [copyError, setCopyError] = useState(null)
  const [pendingBreakdowns, setPendingBreakdowns] = useState(new Set())
  const [showCopiedBanner, setShowCopiedBanner] = useState(false)
  const [editingCard, setEditingCard] = useState(null)
  const [showPdfImport, setShowPdfImport] = useState(false)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [sourceFilter, setSourceFilter] = useState('all')
  const [deletingCat, setDeletingCat] = useState(null) // { id, label, cardCount }
  const lastClickedRef = useRef(null)
  const searchInputRef = useRef(null)

  // Derived: is the current user the owner of this deck?
  const isOwner = deck?.user_id === user?.id

  function triggerOwnedDeckBreakdowns(loadedCards, deckOwnerId) {
    if (deckOwnerId !== user?.id) return
    const nullCards = loadedCards.filter(c => c.breakdown == null)
    if (nullCards.length === 0) return
    setPendingBreakdowns(new Set(nullCards.map(c => c.id)))
    for (const c of nullCards) {
      getOrCreateBreakdown(c.vietnamese, c.id, c.english)
        .then(breakdown => {
          setCards(prev => prev.map(card => card.id === c.id ? { ...card, breakdown } : card))
          setPendingBreakdowns(prev => { const next = new Set(prev); next.delete(c.id); return next })
        })
        .catch(() => {
          setPendingBreakdowns(prev => { const next = new Set(prev); next.delete(c.id); return next })
        })
    }
  }

  async function fetchData() {
    setLoading(true)
    setPendingBreakdowns(new Set())
    const [{ data: deckData, error: deckError }, { data: cardsData, error: cardsError }] = await Promise.all([
      supabase.from('decks').select('*').eq('id', deckId).single(),
      supabase
        .from('flashcards')
        .select('*')
        .eq('deck_id', deckId)
        .order('created_at', { ascending: false }),
    ])
    if (deckError) logError('Failed to load deck', { page: 'deck', action: 'fetchData', err: deckError, details: { deckId } })
    if (cardsError) logError('Failed to load cards', { page: 'deck', action: 'fetchData', err: cardsError, details: { deckId } })
    // If deck is null (deleted or not accessible), return home
    if (!deckData && !deckError) {
      onNavigate('home')
      return
    }
    // Fetch author profile separately (no direct FK between decks and profiles)
    let deckWithProfile = deckData
    if (deckData && deckData.user_id !== user?.id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('display_name, avatar_color')
        .eq('id', deckData.user_id)
        .single()
      deckWithProfile = { ...deckData, profiles: profileData ?? null }
    }
    setDeck(deckWithProfile)
    const loaded = cardsData || []
    setCards(loaded)
    setLoading(false)
    triggerOwnedDeckBreakdowns(loaded, deckData?.user_id)

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
        logError('Failed to upsert recovered categories', { page: 'deck', action: 'fetchData', err })
      )
      onCategoriesChange([...categories, ...recovered])
    }
  }

  // Effects declared after the functions they reference
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [deckId])

  useEffect(() => {
    if (!justCopied) return
    setShowCopiedBanner(true)
    const t = setTimeout(() => setShowCopiedBanner(false), 3000)
    return () => clearTimeout(t)
  }, [justCopied])

  function handleCardCreated(newCard) {
    setCards(prev => [newCard, ...prev])
  }

  function handleBreakdownReady(cardId, breakdown) {
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, breakdown } : c))
  }

  function handlePdfImport(newCards) {
    setCards(prev => [...newCards, ...prev])
    batchGetOrCreateBreakdowns(newCards, handleBreakdownReady)
      .catch(err => logError('pdf import breakdown failed', { page: 'deck', action: 'batch-breakdown', err }))
  }

  function handleModalSave(updatedCard) {
    setCards(prev => prev.map(c => (c.id === updatedCard.id ? updatedCard : c)))
    setEditingCard(null)
  }

  function handleModalDelete(cardId) {
    setCards(prev => prev.filter(c => c.id !== cardId))
    setEditingCard(null)
  }

  async function handleCopyDeck() {
    setCopying(true)
    setCopyError(null)
    const { data: newDeck, error: deckErr } = await supabase
      .from('decks')
      .insert({ title: deck.title, user_id: user.id, is_public: false })
      .select()
      .single()
    if (deckErr) {
      logError('Failed to copy deck', { page: 'deck', action: 'handleCopyDeck', err: deckErr, details: { deckId } })
      setCopyError('Failed to copy deck. Please try again.')
      setCopying(false)
      return
    }
    const cardInserts = cards.map(c => ({
      deck_id: newDeck.id,
      user_id: user.id,
      vietnamese: c.vietnamese,
      english: c.english,
      source: c.source,
      status: 'new',
      breakdown: c.breakdown ?? null,
    }))
    if (cardInserts.length > 0) {
      const { error: cardsErr } = await supabase.from('flashcards').insert(cardInserts)
      if (cardsErr) {
        logError('Failed to copy cards', { page: 'deck', action: 'handleCopyDeck', err: cardsErr, details: { deckId } })
        setCopyError('Deck created but some cards failed to copy.')
      }
    }
    setCopying(false)
    setCopyDone(true)
    setTimeout(() => onNavigate('deck', newDeck.id, null, { justCopied: true }), 600)
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

  const pendingCount = pendingBreakdowns.size

  return (
    <div className="page-fade-in max-w-2xl mx-auto px-4 py-6 md:px-8">
      {showCopiedBanner && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 flex items-center justify-between gap-3 bg-co-fern/10 dark:bg-co-fern/20 border border-co-fern/30 rounded-2xl px-4 py-3 text-sm text-co-fern dark:text-green-400"
        >
          <span className="font-semibold">✓ Saved to your decks</span>
          <button
            onClick={() => setShowCopiedBanner(false)}
            aria-label="Dismiss"
            className="hover:opacity-70 transition-opacity cursor-pointer text-base leading-none"
          >×</button>
        </div>
      )}
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
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl font-bold truncate text-co-ink dark:text-gray-100">
            {deck?.title}
          </h1>
          {!isOwner && deck?.profiles?.display_name && (
            <p className="text-sm text-co-muted dark:text-gray-400 mt-0.5">
              by {deck.profiles.display_name}
            </p>
          )}
        </div>
        <button
          onClick={() => onNavigate('study', deckId)}
          disabled={cards.length === 0}
          className="bg-co-fern text-white px-4 py-2 rounded-full font-semibold text-sm disabled:opacity-40 hover:scale-105 active:scale-95 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-co-fern focus:ring-offset-2 cursor-pointer"
        >
          Study
        </button>
        <button
          onClick={() => onNavigate('quiz', deckId)}
          disabled={cards.length === 0}
          className="bg-co-gold text-co-ink px-4 py-2 rounded-full font-semibold text-sm disabled:opacity-40 hover:scale-105 active:scale-95 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-co-gold focus:ring-offset-2 cursor-pointer"
        >
          Quiz
        </button>
        {!isOwner && (
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleCopyDeck}
              disabled={copying || copyDone || cards.length === 0}
              className={`px-4 py-2 rounded-full font-semibold text-sm disabled:opacity-40 transition-all cursor-pointer disabled:cursor-default focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 ${
                copyDone
                  ? 'bg-co-fern text-white border border-co-fern'
                  : 'bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-600 text-co-ink dark:text-gray-200 hover:enabled:border-co-primary'
              }`}
            >
              {copying ? 'Copying…' : copyDone ? 'Copied! ✓' : 'Copy to my decks'}
            </button>
            {copyError && (
              <p className="text-xs text-red-500 dark:text-red-400 max-w-48 text-right">{copyError}</p>
            )}
          </div>
        )}
      </div>

      {isOwner && (
        <VocabInput
          deckId={deckId}
          onCardCreated={handleCardCreated}
          onCardBreakdownReady={handleBreakdownReady}
          categories={categories}
          onCategoriesChange={onCategoriesChange}
        />
      )}
      {isOwner && (
        <button
          onClick={() => setShowPdfImport(true)}
          className="mt-2 mx-auto flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-dashed border-co-border dark:border-gray-700 text-xs font-semibold text-co-muted dark:text-gray-400 hover:border-co-primary hover:text-co-primary dark:hover:text-co-primary transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2"
          aria-label="Import flashcards from PDF"
        >
          ↑ Import from PDF
        </button>
      )}

      {isOwner && pendingCount > 0 && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="mt-4 flex items-center gap-2 bg-co-surface dark:bg-gray-800/50 border border-co-border dark:border-gray-700 rounded-2xl px-4 py-3 text-sm text-co-muted dark:text-gray-400"
        >
          <span className="flex gap-1" aria-hidden="true">
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
          </span>
          <span>
            Generating word breakdowns for{' '}
            <span className="font-semibold text-co-ink dark:text-gray-200">{pendingCount}</span>
            {' '}{pendingCount === 1 ? 'card' : 'cards'}…
          </span>
        </div>
      )}

      {cards.length > 0 && isOwner && (
        <div className="mt-4 bg-co-surface dark:bg-gray-800/50 border border-co-border dark:border-gray-700 rounded-2xl p-4">
          <div role="search" className="flex items-center gap-2">
            {/* Search icon button + expandable input */}
            <div className="flex items-center shrink-0">
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
            {/* Horizontally scrollable pill strip — outer clips, inner pads so borders aren't cut */}
            <div className="overflow-x-auto min-w-0 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
              <div className="flex items-center gap-2 px-1 py-1">
                {/* All */}
                <button
                  onClick={() => setSourceFilter(sourceFilter === 'all' ? 'untagged' : 'all')}
                  aria-pressed={sourceFilter === 'all'}
                  className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-1 cursor-pointer ${
                    sourceFilter === 'all'
                      ? 'bg-co-primary text-white shadow-sm'
                      : 'bg-white dark:bg-gray-700 text-co-muted dark:text-gray-400 hover:text-co-ink dark:hover:text-gray-200'
                  }`}
                >
                  All
                </button>
                {/* Named categories with × delete */}
                {categories.map(cat => (
                  <div key={cat.id} className="group relative flex items-center shrink-0">
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
                      onClick={e => {
                        e.stopPropagation()
                        const count = cards.filter(c => (c.source || []).includes(cat.id)).length
                        setDeletingCat({ id: cat.id, label: cat.label, cardCount: count })
                      }}
                      aria-label={`Delete ${cat.label} category`}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-co-muted hover:text-red-500 text-sm leading-none focus:opacity-100 focus:outline-none cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
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
                className="text-xs font-semibold text-co-muted dark:text-gray-400"
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
              // Suppress the active filter tag from badges — it's already communicated by the filter
              const displayTags = (sourceFilter !== 'all' && sourceFilter !== 'untagged')
                ? cardTags.filter(t => t !== sourceFilter)
                : cardTags
              return (
                <button
                  key={card.id}
                  aria-label={`${card.vietnamese} — ${card.english}${cardTags.length ? `, ${cardTags.join(', ')}` : ''}`}
                  className={`relative flex flex-col w-full min-h-36 text-left bg-white dark:bg-gray-900 border border-co-border dark:border-gray-700 rounded-2xl p-4 hover:border-co-primary dark:hover:border-co-primary hover:shadow-md transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 ${isOwner ? 'cursor-pointer' : 'cursor-default'} ${
                    card.status === 'learned' ? 'border-l-4 border-l-co-fern' :
                    card.status === 'learning' ? 'border-l-4 border-l-co-gold' : ''
                  }`}
                  onClick={e => {
                    if (!isOwner) return
                    lastClickedRef.current = e.currentTarget
                    setEditingCard(card)
                  }}
                >
                  <div lang="vi" className="flex-1 font-display font-semibold text-co-ink dark:text-gray-100 mb-1.5 line-clamp-3 text-base leading-snug">
                    {card.vietnamese}
                  </div>
                  <div className="text-co-muted dark:text-gray-300 text-sm line-clamp-2 mb-2">
                    {card.english}
                  </div>
                  {displayTags.length > 0 && (
                    <div aria-hidden="true" className="mt-auto flex flex-wrap gap-1">
                      {displayTags.map(tagId => (
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
                  {pendingBreakdowns.has(card.id) && (
                    <span aria-hidden="true" className="absolute top-2 right-2 w-2 h-2 rounded-full bg-co-primary animate-pulse" />
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
      {deletingCat && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-cat-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeletingCat(null)} aria-hidden="true" />
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 flex flex-col gap-4">
            <h2 id="delete-cat-title" className="font-display font-bold text-lg text-co-ink dark:text-gray-100">
              Delete "{deletingCat.label}"?
            </h2>
            <p className="text-sm text-co-muted dark:text-gray-400 leading-relaxed">
              {deletingCat.cardCount > 0
                ? <>This tag will be removed from <span className="font-semibold text-co-ink dark:text-gray-200">{deletingCat.cardCount} {deletingCat.cardCount === 1 ? 'card' : 'cards'}</span>. The cards themselves won't be deleted.</>
                : <>This tag isn't used on any cards yet.</>
              }
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeletingCat(null)}
                className="px-4 py-2 rounded-full text-sm font-semibold text-co-muted dark:text-gray-400 hover:text-co-ink dark:hover:text-gray-200 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                onClick={() => { handleDeleteCategory(deletingCat.id); setDeletingCat(null) }}
                className="px-4 py-2 rounded-full text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Delete tag
              </button>
            </div>
          </div>
        </div>
      )}
      {showPdfImport && isOwner && (
        <PdfImportModal
          deckId={deckId}
          categories={categories}
          onCategoriesChange={onCategoriesChange}
          onCardsImported={handlePdfImport}
          onClose={() => setShowPdfImport(false)}
        />
      )}
    </div>
  )
}
