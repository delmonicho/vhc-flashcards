import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
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

export default function Home({ onNavigate, dark, onToggleDark }) {
  const [weeks, setWeeks] = useState([])
  const [cardCounts, setCardCounts] = useState({})
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

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

  return (
    <div className="page-fade-in max-w-2xl mx-auto px-4 py-6 md:px-8">
      {/* Top bar */}
      <div className="flex items-center justify-end gap-3 mb-2">
        <button
          onClick={() => onNavigate('import')}
          className="text-sm text-co-muted dark:text-gray-400 hover:text-co-primary dark:hover:text-co-primary transition-colors"
        >
          Import Breakdowns
        </button>
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
            <button
              key={week.id}
              onClick={() => onNavigate('week', week.id)}
              className="w-full text-left bg-white dark:bg-gray-900 border border-co-border dark:border-gray-700 rounded-2xl px-5 py-4 hover:border-co-primary dark:hover:border-co-primary hover:shadow-md transition-all duration-150 active:scale-[0.99]"
            >
              <div className="font-display font-semibold text-co-ink dark:text-gray-100 text-lg leading-snug">
                {week.title}
              </div>
              <div className="text-sm text-co-muted dark:text-gray-400 mt-1">
                {cardCounts[week.id] || 0}{' '}
                {(cardCounts[week.id] || 0) === 1 ? 'card' : 'cards'}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
