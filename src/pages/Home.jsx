import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { backfillBreakdownCache } from '../lib/breakdown'
import Logo from '../components/Logo.old'
import ThemeToggle from '../components/ThemeToggle'

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
          This will permanently delete the week and all {cardCount || 0}{' '}
          {(cardCount || 0) === 1 ? 'card' : 'cards'} inside it.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 bg-red-500 text-white py-3.5 rounded-2xl font-semibold disabled:opacity-50 hover:bg-red-600 active:scale-95 transition-all"
          >
            {deleting ? 'Deleting…' : 'Delete week'}
          </button>
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 bg-co-surface dark:bg-gray-800 text-co-ink dark:text-gray-200 py-3.5 rounded-2xl font-semibold"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Home({ onNavigate, dark, onToggleDark }) {
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
  const editInputRef = useRef(null)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (editingWeekId) editInputRef.current?.focus()
  }, [editingWeekId])

  async function fetchData() {
    setLoading(true)
    const [{ data: weeksData }, { data: cardsData }] = await Promise.all([
      supabase.from('weeks').select('*').order('created_at', { ascending: false }),
      supabase.from('flashcards').select('id, week_id'),
    ])
    setWeeks(weeksData || [])
    const counts = {}
    for (const card of cardsData || []) {
      counts[card.week_id] = (counts[card.week_id] || 0) + 1
    }
    setCardCounts(counts)
    setLoading(false)
  }

  async function createWeek(e) {
    e.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    const { data, error } = await supabase
      .from('weeks')
      .insert({ title: title.trim() })
      .select()
      .single()
    if (!error && data) {
      setWeeks([data, ...weeks])
      setCardCounts({ ...cardCounts, [data.id]: 0 })
      setTitle('')
    }
    setCreating(false)
  }

  function startEditing(week, e) {
    e.stopPropagation()
    setEditingWeekId(week.id)
    setEditingTitle(week.title)
  }

  async function saveEdit(weekId) {
    const trimmed = editingTitle.trim()
    if (!trimmed) {
      cancelEdit()
      return
    }
    const original = weeks.find(w => w.id === weekId)?.title
    if (trimmed === original) {
      cancelEdit()
      return
    }
    setWeeks(prev => prev.map(w => (w.id === weekId ? { ...w, title: trimmed } : w)))
    setEditingWeekId(null)
    await supabase.from('weeks').update({ title: trimmed }).eq('id', weekId)
  }

  function cancelEdit() {
    setEditingWeekId(null)
    setEditingTitle('')
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await Promise.all([
      supabase.from('flashcards').delete().eq('week_id', deleteTarget.id),
      supabase.from('weeks').delete().eq('id', deleteTarget.id),
    ])
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
      {/* Top bar */}
      <div className="flex items-center justify-end gap-3 mb-2">
        <ThemeToggle dark={dark} onToggle={onToggleDark} />
      </div>

      {/* Hero */}
      <div className="flex flex-col items-center text-center mb-10 pt-4">
        <Logo size="lg" />
        <h1 className="font-display text-5xl font-bold text-co-primary mt-4 mb-1">
          Cô Ơi
        </h1>
        <p className="text-co-muted dark:text-gray-400 text-base">
          your Vietnamese class companion
        </p>
      </div>

      {/* Create week */}
      <form onSubmit={createWeek} className="flex gap-2 mb-8">
        <input
          className="flex-1 border border-co-border dark:border-gray-600 rounded-xl px-4 py-3 text-base bg-white dark:bg-gray-800 text-co-ink dark:text-gray-100 placeholder-co-muted dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-co-primary transition-shadow"
          placeholder='New week, e.g. "Week 3 — Family"'
          value={title}
          onChange={e => setTitle(e.target.value)}
          disabled={creating}
        />
        <button
          type="submit"
          disabled={creating || !title.trim()}
          className="bg-co-primary text-white px-6 py-3 rounded-full font-semibold disabled:opacity-50 hover:scale-105 active:scale-95 transition-all duration-150 whitespace-nowrap"
        >
          {creating ? 'Creating…' : '+ Week'}
        </button>
      </form>

      {/* Week list */}
      {loading ? (
        <LoadingDots />
      ) : weeks.length === 0 ? (
        <p className="text-co-muted dark:text-gray-400 text-center py-12">
          No weeks yet. Create your first one above.
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
                onClick={() => editingWeekId !== week.id && onNavigate('week', week.id)}
                className="flex-1 text-left px-5 py-4 min-w-0"
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
                </div>
              </button>

              {/* Edit button */}
              <button
                onClick={e => startEditing(week, e)}
                className="w-11 h-11 flex items-center justify-center text-co-muted dark:text-gray-500 hover:text-co-primary dark:hover:text-co-primary transition-colors flex-shrink-0"
                aria-label="Edit week title"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                </svg>
              </button>

              {/* Delete button */}
              <button
                onClick={e => { e.stopPropagation(); setDeleteTarget(week) }}
                className="w-11 h-11 flex items-center justify-center text-co-muted dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors flex-shrink-0 mr-1"
                aria-label="Delete week"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dev-only: backfill breakdown cache */}
      {import.meta.env.DEV && (
        <div className="mt-10 pt-6 border-t border-co-border dark:border-gray-700 text-center">
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
            className="text-xs text-co-muted dark:text-gray-500 hover:text-co-primary dark:hover:text-co-primary disabled:opacity-50 transition-colors"
          >
            {backfilling ? 'Backfilling…' : 'Backfill breakdown cache'}
          </button>
        </div>
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
