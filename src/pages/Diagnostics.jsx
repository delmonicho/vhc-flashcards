import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="font-display font-semibold text-sm uppercase tracking-wide text-co-muted dark:text-gray-400 mb-3">
        {title}
      </h2>
      {children}
    </div>
  )
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-co-surface dark:bg-gray-800 rounded-xl p-4">
      <div className="text-2xl font-bold font-display text-co-ink dark:text-gray-100">{value ?? '—'}</div>
      <div className="text-xs text-co-muted dark:text-gray-400 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-co-muted dark:text-gray-500 mt-0.5">{sub}</div>}
    </div>
  )
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function Diagnostics({ onNavigate, dark, onToggleDark }) {
  const [stats, setStats] = useState(null)
  const [recentErrors, setRecentErrors] = useState([])
  const [errorSummary, setErrorSummary] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  const loadedAt = new Date().toISOString()

  useEffect(() => {
    async function load() {
      const [
        weeksRes, cardsRes, breakdownsRes, categoriesRes, gameStatsRes, logsRes,
        withBdRes, withoutBdRes,
        errorsRes,
      ] = await Promise.all([
        supabase.from('decks').select('*', { count: 'exact', head: true }),
        supabase.from('flashcards').select('*', { count: 'exact', head: true }),
        supabase.from('breakdowns').select('*', { count: 'exact', head: true }),
        supabase.from('categories').select('*', { count: 'exact', head: true }),
        supabase.from('game_stats').select('*', { count: 'exact', head: true }),
        supabase.from('logs').select('*', { count: 'exact', head: true }),
        supabase.from('flashcards').select('*', { count: 'exact', head: true }).not('breakdown', 'is', null),
        supabase.from('flashcards').select('*', { count: 'exact', head: true }).is('breakdown', null),
        supabase.from('logs').select('created_at, page, action, message, details').eq('type', 'error').order('created_at', { ascending: false }).limit(200),
      ])

      setStats({
        decks: weeksRes.count ?? 0,
        flashcards: cardsRes.count ?? 0,
        breakdowns: breakdownsRes.count ?? 0,
        categories: categoriesRes.count ?? 0,
        gameStats: gameStatsRes.count ?? 0,
        logs: logsRes.count ?? 0,
        withBreakdown: withBdRes.count ?? 0,
        withoutBreakdown: withoutBdRes.count ?? 0,
      })

      const errors = errorsRes.data || []
      setRecentErrors(errors.slice(0, 25))

      // Group by page + action for hotspot summary
      const grouped = {}
      for (const e of errors) {
        const key = `${e.page || '—'}|${e.action || '—'}`
        grouped[key] = (grouped[key] || 0) + 1
      }
      const summary = Object.entries(grouped)
        .map(([key, count]) => { const [page, action] = key.split('|'); return { page, action, count } })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
      setErrorSummary(summary)

      setLoading(false)
    }
    load()
  }, [])

  const totalCards = (stats?.withBreakdown ?? 0) + (stats?.withoutBreakdown ?? 0)
  const coveragePct = totalCards > 0 ? Math.round((stats.withBreakdown / totalCards) * 100) : 0

  return (
    <div className="page-fade-in max-w-3xl mx-auto px-4 py-6 md:px-8">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-1.5 text-sm text-co-muted dark:text-gray-400 hover:text-co-ink dark:hover:text-gray-100 transition-colors cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          Back
        </button>
      </div>

      <h1 className="font-display text-3xl font-bold text-co-ink dark:text-gray-100 mb-8">
        Diagnostics
      </h1>

      {loading ? (
        <div className="flex justify-center gap-2 py-16">
          <span className="loading-dot" />
          <span className="loading-dot" />
          <span className="loading-dot" />
        </div>
      ) : (
        <>
          {/* Section 1: DB Health */}
          <Section title="Database">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              <StatCard label="decks" value={stats.decks} />
              <StatCard label="flashcards" value={stats.flashcards} />
              <StatCard label="breakdowns" value={stats.breakdowns} />
              <StatCard label="categories" value={stats.categories} />
              <StatCard label="game stats" value={stats.gameStats} />
              <StatCard label="logs" value={stats.logs} />
            </div>
          </Section>

          {/* Section 2: Breakdown Coverage */}
          <Section title="Breakdown Coverage">
            <div className="bg-co-surface dark:bg-gray-800 rounded-xl p-4">
              <div className="flex items-end justify-between mb-2">
                <span className="text-co-ink dark:text-gray-100 font-semibold">
                  {stats.withBreakdown} / {totalCards} cards
                </span>
                <span className="text-co-muted dark:text-gray-400 text-sm">{coveragePct}%</span>
              </div>
              <div className="w-full bg-co-border dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-co-fern h-2 rounded-full transition-all"
                  style={{ width: `${coveragePct}%` }}
                />
              </div>
              {stats.withoutBreakdown > 0 && (
                <p className="text-xs text-co-muted dark:text-gray-400 mt-2">
                  {stats.withoutBreakdown} card{stats.withoutBreakdown !== 1 ? 's' : ''} pending breakdown generation
                </p>
              )}
            </div>
          </Section>

          {/* Section 3: Error Hotspots */}
          <Section title="Error Hotspots">
            {errorSummary.length === 0 ? (
              <p className="text-sm text-co-muted dark:text-gray-400">No errors logged.</p>
            ) : (
              <div className="bg-co-surface dark:bg-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-co-border dark:border-gray-700">
                      <th className="text-left px-4 py-2 text-xs text-co-muted dark:text-gray-400 font-medium">Page</th>
                      <th className="text-left px-4 py-2 text-xs text-co-muted dark:text-gray-400 font-medium">Action</th>
                      <th className="text-right px-4 py-2 text-xs text-co-muted dark:text-gray-400 font-medium">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorSummary.map((row, i) => (
                      <tr key={i} className="border-b border-co-border dark:border-gray-700 last:border-0">
                        <td className="px-4 py-2 text-co-ink dark:text-gray-200 font-mono text-xs">{row.page}</td>
                        <td className="px-4 py-2 text-co-ink dark:text-gray-200 font-mono text-xs">{row.action}</td>
                        <td className="px-4 py-2 text-right font-semibold text-co-primary">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Section 4: Recent Errors */}
          <Section title="Recent Errors">
            {recentErrors.length === 0 ? (
              <p className="text-sm text-co-muted dark:text-gray-400">No errors logged.</p>
            ) : (
              <div className="space-y-1">
                {recentErrors.map((err, i) => {
                  const isOpen = expandedId === i
                  return (
                    <div key={i} className="bg-co-surface dark:bg-gray-800 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedId(isOpen ? null : i)}
                        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-co-border/40 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                      >
                        <span className="text-xs text-co-muted dark:text-gray-500 whitespace-nowrap mt-0.5 min-w-[60px]">
                          {timeAgo(err.created_at)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-co-muted dark:text-gray-400 mb-0.5">
                            {err.page || '—'} › {err.action || '—'}
                          </div>
                          <div className="text-sm text-co-ink dark:text-gray-100 truncate">{err.message}</div>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                          className={`w-4 h-4 text-co-muted dark:text-gray-500 shrink-0 mt-0.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true">
                          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {isOpen && err.details && (
                        <pre className="px-4 pb-3 text-xs text-co-muted dark:text-gray-400 overflow-x-auto whitespace-pre-wrap break-all border-t border-co-border dark:border-gray-700">
                          {JSON.stringify(err.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          {/* Section 5: Environment */}
          <Section title="Environment">
            <div className="bg-co-surface dark:bg-gray-800 rounded-xl p-4 font-mono text-xs space-y-1">
              {[
                ['mode', import.meta.env.MODE],
                ['supabase url', import.meta.env.VITE_SUPABASE_URL],
                ['page loaded', loadedAt],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <span className="text-co-muted dark:text-gray-500 min-w-[110px]">{k}</span>
                  <span className="text-co-ink dark:text-gray-200 break-all">{v}</span>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  )
}
