import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { backfillBreakdownCache } from '../lib/breakdown'
import { logError } from '../lib/logger'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo.old'

function LoadingDots() {
  return (
    <div className="flex justify-center gap-2 py-16">
      <span className="loading-dot" />
      <span className="loading-dot" />
      <span className="loading-dot" />
    </div>
  )
}

function DeleteSheet({ week, cardCount, onConfirm, onCancel, deleting }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white dark:bg-gray-900 rounded-t-3xl px-6 pt-6 pb-10 shadow-2xl">
        <div className="w-10 h-1 bg-co-border dark:bg-gray-700 rounded-full mx-auto mb-6" />
        <p className="font-display text-lg font-semibold text-co-ink dark:text-gray-100 mb-1">
          Delete "{week.title}"?
        </p>
        <p className="text-sm text-co-muted dark:text-gray-400 mb-6">
          This will permanently delete the deck and all {cardCount || 0}{' '}
          {(cardCount || 0) === 1 ? 'card' : 'cards'} inside it.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 bg-red-500 text-white py-3.5 rounded-2xl font-semibold disabled:opacity-50 hover:bg-red-600 active:scale-95 transition-all cursor-pointer"
          >
            {deleting ? 'Deleting…' : 'Delete deck'}
          </button>
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 bg-co-surface dark:bg-gray-800 text-co-ink dark:text-gray-200 py-3.5 rounded-2xl font-semibold cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Home({ onNavigate, dark, onToggleDark }) {
  const { user } = useAuth()

  // My Decks state
  const [weeks, setWeeks] = useState([])
  const [cardCounts, setCardCounts] = useState({})
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingWeekId, setEditingWeekId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [backfilling, setBackfilling] = useState(false)
  const [togglingId, setTogglingId] = useState(null)
  const editInputRef = useRef(null)

  // Tab + Public Decks state
  const [tab, setTab] = useState('mine')
  const [publicDecks, setPublicDecks] = useState([])
  const [publicDecksLoading, setPublicDecksLoading] = useState(false)
  const [publicFetched, setPublicFetched] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (editingWeekId) editInputRef.current?.focus()
  }, [editingWeekId])

  async function fetchData() {
    setLoading(true)
    const [
      { data: weeksData, error: weeksError },
      { data: cardsData, error: cardsError },
    ] = await Promise.all([
      // Explicit user_id filter — after RLS migration, plain select() would also return public decks from others
      supabase.from('decks').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('flashcards').select('id, deck_id'),
    ])
    if (weeksError) logError('Failed to load decks', { page: 'home', action: 'fetchData', err: weeksError })
    if (cardsError) logError('Failed to load card counts', { page: 'home', action: 'fetchData', err: cardsError })
    setWeeks(weeksData || [])
    const counts = {}
    for (const card of cardsData || []) {
      counts[card.deck_id] = (counts[card.deck_id] || 0) + 1
    }
    setCardCounts(counts)
    setLoading(false)
  }

  async function fetchPublicDecks() {
    setPublicDecksLoading(true)
    const { data: pubWeeks, error: weeksErr } = await supabase
      .from('decks')
      .select('*')
      .eq('is_public', true)
      .neq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (weeksErr) {
      logError('Failed to load public decks', { page: 'home', action: 'fetchPublicDecks', err: weeksErr })
      setPublicDecksLoading(false)
      return
    }

    // Batch-fetch author profiles
    const authorIds = [...new Set((pubWeeks || []).map(w => w.user_id))]
    let profileMap = {}
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_color')
        .in('id', authorIds)
      profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    }

    setPublicDecks((pubWeeks || []).map(w => ({ ...w, author: profileMap[w.user_id] ?? null })))
    setPublicDecksLoading(false)
    setPublicFetched(true)
  }

  async function createWeek(e) {
    e.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    const { data, error } = await supabase
      .from('decks')
      .insert({ title: title.trim(), user_id: user.id, is_public: false })
      .select()
      .single()
    if (!error && data) {
      setWeeks([data, ...weeks])
      setCardCounts({ ...cardCounts, [data.id]: 0 })
      setTitle('')
    } else if (error) {
      logError('Failed to create deck', { page: 'home', action: 'createWeek', err: error, details: { title } })
    }
    setCreating(false)
  }

  async function togglePublic(week, e) {
    e.stopPropagation()
    const next = !week.is_public
    setTogglingId(week.id)
    setWeeks(prev => prev.map(w => w.id === week.id ? { ...w, is_public: next } : w))
    const { error } = await supabase.from('decks').update({ is_public: next }).eq('id', week.id)
    if (error) {
      logError('Failed to toggle deck visibility', { page: 'home', action: 'togglePublic', err: error, details: { deckId: week.id } })
      setWeeks(prev => prev.map(w => w.id === week.id ? { ...w, is_public: !next } : w))
    }
    setTogglingId(null)
  }

  function startEditing(week, e) {
    e.stopPropagation()
    setEditingWeekId(week.id)
    setEditingTitle(week.title)
  }

  async function saveEdit(deckId) {
    const trimmed = editingTitle.trim()
    if (!trimmed) {
      cancelEdit()
      return
    }
    const original = weeks.find(w => w.id === deckId)?.title
    if (trimmed === original) {
      cancelEdit()
      return
    }
    setWeeks(prev => prev.map(w => (w.id === deckId ? { ...w, title: trimmed } : w)))
    setEditingWeekId(null)
    await supabase.from('decks').update({ title: trimmed }).eq('id', deckId)
  }

  function cancelEdit() {
    setEditingWeekId(null)
    setEditingTitle('')
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const [flashcardsResult, decksResult] = await Promise.all([
      supabase.from('flashcards').delete().eq('deck_id', deleteTarget.id),
      supabase.from('decks').delete().eq('id', deleteTarget.id),
    ])
    if (flashcardsResult.error) logError('Failed to delete flashcards on deck delete', { page: 'home', action: 'deleteDeck', err: flashcardsResult.error, details: { deckId: deleteTarget.id } })
    if (decksResult.error) logError('Failed to delete deck', { page: 'home', action: 'deleteDeck', err: decksResult.error, details: { deckId: deleteTarget.id } })
    setWeeks(prev => prev.filter(w => w.id !== deleteTarget.id))
    setCardCounts(prev => {
      const next = { ...prev }
      delete next[deleteTarget.id]
      return next
    })
    setDeleting(false)
    setDeleteTarget(null)
  }

  return (
    <div className="page-fade-in max-w-2xl mx-auto px-4 py-6 md:px-8">

      {/* Hero */}
      <div className="flex flex-col items-center text-center mb-10 pt-4">
        <Logo size="lg" />
        <h1 className="font-display text-5xl font-bold text-co-primary mt-4 mb-1">
          Cô Ơi
        </h1>
        <p className="text-co-muted dark:text-gray-400 text-base">
          Your Vietnamese class companion
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-co-surface dark:bg-gray-800 rounded-2xl p-1 mb-6">
        <button
          onClick={() => setTab('mine')}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-1 ${
            tab === 'mine'
              ? 'bg-white dark:bg-gray-900 text-co-ink dark:text-gray-100 shadow-sm'
              : 'text-co-muted dark:text-gray-400 hover:text-co-ink dark:hover:text-gray-200'
          }`}
        >
          My Decks
        </button>
        <button
          onClick={() => {
            setTab('public')
            if (!publicFetched && !publicDecksLoading) fetchPublicDecks()
          }}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-1 ${
            tab === 'public'
              ? 'bg-white dark:bg-gray-900 text-co-ink dark:text-gray-100 shadow-sm'
              : 'text-co-muted dark:text-gray-400 hover:text-co-ink dark:hover:text-gray-200'
          }`}
        >
          Public Decks
        </button>
      </div>

      {/* ── My Decks tab ── */}
      {tab === 'mine' && (
        <>
          {/* Create deck */}
          <form onSubmit={createWeek} className="flex gap-2 mb-8">
            <input
              className="flex-1 border border-co-border dark:border-gray-600 rounded-xl px-4 py-3 text-base bg-white dark:bg-gray-800 text-co-ink dark:text-gray-100 placeholder-co-muted dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-co-primary transition-shadow"
              placeholder='New deck, e.g. "Week 3 — Family"'
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={creating}
            />
            <button
              type="submit"
              disabled={creating || !title.trim()}
              className="bg-co-primary text-white px-6 py-3 rounded-full font-semibold disabled:opacity-50 hover:enabled:scale-105 active:enabled:scale-95 transition-all duration-150 whitespace-nowrap cursor-pointer disabled:cursor-default"
            >
              {creating ? 'Creating…' : '+ Deck'}
            </button>
          </form>

          {/* Week list */}
          {loading ? (
            <LoadingDots />
          ) : weeks.length === 0 ? (
            <p className="text-co-muted dark:text-gray-400 text-center py-12">
              No decks yet. Create your first one above.
            </p>
          ) : (
            <div className="space-y-3">
              {weeks.map(week => (
                <div
                  key={week.id}
                  className="flex items-center bg-white dark:bg-gray-900 border border-co-border dark:border-gray-700 rounded-2xl hover:border-co-primary dark:hover:border-co-primary hover:shadow-md transition-all duration-150 overflow-hidden"
                >
                  {/* Main navigate area */}
                  <button
                    onClick={() => editingWeekId !== week.id && onNavigate('deck', week.id)}
                    className="flex-1 text-left px-5 py-4 min-w-0 cursor-pointer"
                  >
                    {editingWeekId === week.id ? (
                      <input
                        ref={editInputRef}
                        className="w-full font-display font-semibold text-lg text-co-ink dark:text-gray-100 bg-transparent border-b-2 border-co-primary outline-none"
                        value={editingTitle}
                        onChange={e => setEditingTitle(e.target.value)}
                        onBlur={() => saveEdit(week.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveEdit(week.id)
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <div className="font-display font-semibold text-co-ink dark:text-gray-100 text-lg leading-snug truncate">
                        {week.title}
                      </div>
                    )}
                    <div className="text-sm text-co-muted dark:text-gray-400 mt-0.5">
                      {cardCounts[week.id] || 0}{' '}
                      {(cardCounts[week.id] || 0) === 1 ? 'card' : 'cards'}
                      {week.is_public && (
                        <span className="ml-2 text-co-fern dark:text-green-400 font-semibold">· Public</span>
                      )}
                    </div>
                  </button>

                  {/* Visibility toggle */}
                  <button
                    onClick={e => togglePublic(week, e)}
                    disabled={togglingId === week.id}
                    aria-label={week.is_public ? 'Make deck private' : 'Make deck public'}
                    className="w-11 h-11 flex items-center justify-center transition-colors flex-shrink-0 disabled:opacity-40 cursor-pointer disabled:cursor-default"
                  >
                    {week.is_public ? (
                      /* Globe — deck is public */
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-co-fern dark:text-green-400" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      /* Lock — deck is private */
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-co-muted dark:text-gray-500 hover:text-co-primary" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>

                  {/* Edit button */}
                  <button
                    onClick={e => startEditing(week, e)}
                    className="w-11 h-11 flex items-center justify-center text-co-muted dark:text-gray-500 hover:text-co-primary dark:hover:text-co-primary transition-colors flex-shrink-0 cursor-pointer"
                    aria-label="Edit week title"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                      <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                    </svg>
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteTarget(week) }}
                    className="w-11 h-11 flex items-center justify-center text-co-muted dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors flex-shrink-0 mr-1 cursor-pointer"
                    aria-label="Delete week"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Dev-only: backfill breakdown cache */}
          {import.meta.env.DEV && (
            <div className="mt-10 pt-6 border-t border-co-border dark:border-gray-700 text-center flex items-center justify-center gap-1">
              <button
                onClick={async () => {
                  setBackfilling(true)
                  try {
                    const count = await backfillBreakdownCache()
                    alert(`Backfilled ${count} breakdown(s) into cache.`)
                  } catch (e) {
                    alert(`Backfill failed: ${e.message}`)
                  } finally {
                    setBackfilling(false)
                  }
                }}
                disabled={backfilling}
                className="text-xs text-co-muted dark:text-gray-500 hover:text-co-primary dark:hover:text-co-primary disabled:opacity-50 transition-colors cursor-pointer"
              >
                {backfilling ? 'Backfilling…' : 'Backfill breakdown cache'}
              </button>
              <span className="text-co-border dark:text-gray-700 text-xs mx-1">·</span>
              <button
                onClick={() => onNavigate('diagnostics')}
                aria-label="Diagnostics"
                className="text-co-muted dark:text-gray-500 hover:text-co-primary dark:hover:text-co-primary transition-colors cursor-pointer group"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  className="w-4 h-4 group-hover:animate-spin" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <line x1="12" y1="3" x2="12" y2="7" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                  <line x1="3" y1="12" x2="7" y2="12" />
                  <line x1="17" y1="12" x2="21" y2="12" />
                  <line x1="5.6" y1="5.6" x2="8.5" y2="8.5" />
                  <line x1="15.5" y1="15.5" x2="18.4" y2="18.4" />
                  <line x1="18.4" y1="5.6" x2="15.5" y2="8.5" />
                  <line x1="8.5" y1="15.5" x2="5.6" y2="18.4" />
                  <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Public Decks tab ── */}
      {tab === 'public' && (
        publicDecksLoading ? (
          <LoadingDots />
        ) : publicDecks.length === 0 ? (
          <p className="text-co-muted dark:text-gray-400 text-center py-12 text-sm">
            No public decks yet.
          </p>
        ) : (
          <div className="space-y-3">
            {publicDecks.map(deck => {
              const count = cardCounts[deck.id] || 0
              return (
                <div
                  key={deck.id}
                  className="flex items-center bg-white dark:bg-gray-900 border border-co-border dark:border-gray-700 rounded-2xl hover:border-co-primary dark:hover:border-co-primary hover:shadow-md transition-all duration-150 overflow-hidden"
                >
                  <button
                    onClick={() => onNavigate('deck', deck.id)}
                    className="flex-1 text-left px-5 py-4 min-w-0 cursor-pointer"
                  >
                    <div className="font-display font-semibold text-co-ink dark:text-gray-100 text-lg leading-snug truncate">
                      {deck.title}
                    </div>
                    <div className="text-sm text-co-muted dark:text-gray-400 mt-0.5">
                      {count} {count === 1 ? 'card' : 'cards'}
                      {deck.author?.display_name && (
                        <span className="ml-2">· by {deck.author.display_name}</span>
                      )}
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Delete confirmation bottom sheet */}
      {deleteTarget && (
        <DeleteSheet
          week={deleteTarget}
          cardCount={cardCounts[deleteTarget.id]}
          onConfirm={handleDelete}
          onCancel={() => !deleting && setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
    </div>
  )
}
