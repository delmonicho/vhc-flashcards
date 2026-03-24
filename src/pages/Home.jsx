import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ThemeToggle from '../components/ThemeToggle'

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
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Vietnamese Companion
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('import')}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Import Breakdowns
          </button>
          <ThemeToggle dark={dark} onToggle={onToggleDark} />
        </div>
      </div>

      <form onSubmit={createWeek} className="flex gap-2 mb-8">
        <input
          className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder='New week title, e.g. "Week 1 — Greetings"'
          value={title}
          onChange={e => setTitle(e.target.value)}
          disabled={creating}
        />
        <button
          type="submit"
          disabled={creating || !title.trim()}
          className="bg-blue-600 text-white px-5 py-3 rounded-lg font-medium disabled:opacity-50 active:bg-blue-700"
        >
          {creating ? 'Creating…' : 'Create'}
        </button>
      </form>

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-12">Loading weeks…</p>
      ) : weeks.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-12">
          No weeks yet. Create your first one above.
        </p>
      ) : (
        <div className="space-y-3">
          {weeks.map(week => (
            <button
              key={week.id}
              onClick={() => onNavigate('week', week.id)}
              className="w-full text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-5 py-4 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm transition-all active:bg-gray-50 dark:active:bg-gray-800"
            >
              <div className="font-semibold text-gray-900 dark:text-gray-100 text-lg">
                {week.title}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {cardCounts[week.id] || 0} {(cardCounts[week.id] || 0) === 1 ? 'card' : 'cards'}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
