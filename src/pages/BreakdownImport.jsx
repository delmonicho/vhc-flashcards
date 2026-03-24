import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ThemeToggle from '../components/ThemeToggle'

const CLAUDE_PROMPT_PREFIX = `For each numbered Vietnamese phrase below, generate a word-by-word breakdown aligned with the English translation. Return ONLY a valid JSON array — no markdown fences, no explanation. Use this exact format:

[
  {
    "index": 1,
    "vietnamese": "<exact phrase as given, without the [N] prefix>",
    "breakdown": [
      { "vi": "<Vietnamese chunk>", "en": "<English chunk>" }
    ]
  }
]

Keep chunks to 1–3 words. The "vietnamese" value must exactly match the phrase as given (no [N] prefix). Preserve the same order and include every phrase.

Phrases:
`

function buildPrompt(cards) {
  return CLAUDE_PROMPT_PREFIX + cards.map((c, i) => `[${i + 1}] ${c.vietnamese}`).join('\n')
}

function normalizeText(s) {
  return s.trim().replace(/\s+/g, ' ')
}

export default function BreakdownImport({ onNavigate, dark, onToggleDark }) {
  const [weeks, setWeeks] = useState([])
  const [selectedWeekId, setSelectedWeekId] = useState('')
  const [copied, setCopied] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [parsed, setParsed] = useState(null)
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState(null)

  useEffect(() => {
    supabase
      .from('weeks')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setWeeks(data || []))
  }, [])

  async function handleWeekChange(weekId) {
    setSelectedWeekId(weekId)
    setCopied(false)
    setParsed(null)
    setResults(null)
    if (!weekId) return

    const { data: cards } = await supabase
      .from('flashcards')
      .select('vietnamese')
      .eq('week_id', weekId)
      .order('created_at', { ascending: true })

    if (cards?.length) {
      await navigator.clipboard.writeText(buildPrompt(cards))
      setCopied(true)
    }
  }

  function handlePreview() {
    setParseError('')
    setParsed(null)
    setResults(null)
    try {
      const data = JSON.parse(jsonText.trim())
      if (!Array.isArray(data)) throw new Error('Expected a JSON array at the top level.')
      for (const item of data) {
        if (typeof item.vietnamese !== 'string') throw new Error('Each item must have a "vietnamese" string field.')
        if (!Array.isArray(item.breakdown)) throw new Error('Each item must have a "breakdown" array.')
        if (item.index != null && typeof item.index !== 'number') throw new Error('"index" must be a number.')
      }
      setParsed(data)
    } catch (err) {
      setParseError(err.message)
    }
  }

  async function handleImport() {
    if (!parsed || !selectedWeekId) return
    setImporting(true)
    setResults(null)

    const { data: cards } = await supabase
      .from('flashcards')
      .select('id, vietnamese')
      .eq('week_id', selectedWeekId)

    // Build both an index map (1-based) and a normalized string map for fallback
    const indexMap = {}
    const stringMap = {}
    for (let i = 0; i < (cards || []).length; i++) {
      indexMap[i + 1] = cards[i].id
      stringMap[normalizeText(cards[i].vietnamese)] = cards[i].id
    }

    let updated = 0
    const notFound = []

    for (const item of parsed) {
      const cardId =
        (item.index != null ? indexMap[item.index] : null) ??
        stringMap[normalizeText(item.vietnamese)]
      if (!cardId) {
        notFound.push(item.vietnamese)
        continue
      }
      const { error } = await supabase
        .from('flashcards')
        .update({ breakdown: item.breakdown })
        .eq('id', cardId)
      if (!error) updated++
    }

    setResults({ updated, notFound })
    setImporting(false)
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => onNavigate('home')}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-2xl leading-none"
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="flex-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
          Import Breakdowns
        </h1>
        <ThemeToggle dark={dark} onToggle={onToggleDark} />
      </div>

      {/* Instructions */}
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-6 text-sm text-gray-600 dark:text-gray-400 space-y-1">
        <p>1. <strong className="text-gray-800 dark:text-gray-200">Select a week</strong> — the Claude prompt is copied to your clipboard automatically.</p>
        <p>2. Paste into a Claude chat and send. Copy the JSON it returns.</p>
        <p>3. Paste the JSON below, preview, then import.</p>
      </div>

      {/* Week selector */}
      <div className="mb-6">
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
          Week
        </label>
        <div className="flex items-center gap-3">
          <select
            value={selectedWeekId}
            onChange={e => handleWeekChange(e.target.value)}
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a week…</option>
            {weeks.map(w => (
              <option key={w.id} value={w.id}>{w.title}</option>
            ))}
          </select>
          {copied && (
            <span className="text-sm text-green-600 dark:text-green-400 font-medium whitespace-nowrap">
              ✓ Prompt copied
            </span>
          )}
        </div>
      </div>

      {/* JSON textarea */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
          Paste JSON from Claude
        </label>
        <textarea
          value={jsonText}
          onChange={e => { setJsonText(e.target.value); setParsed(null); setResults(null) }}
          placeholder='[{"vietnamese": "...", "breakdown": [{"vi": "...", "en": "..."}]}]'
          rows={10}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-sm font-mono bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {parseError && (
        <p className="text-red-600 dark:text-red-400 text-sm mb-4">{parseError}</p>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={handlePreview}
          disabled={!jsonText.trim() || !selectedWeekId}
          className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-2.5 rounded-lg font-medium disabled:opacity-50 active:bg-gray-50 dark:active:bg-gray-800"
        >
          Preview
        </button>
        <button
          onClick={handleImport}
          disabled={!parsed || importing || !selectedWeekId}
          className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium disabled:opacity-50 active:bg-blue-700"
        >
          {importing ? 'Importing…' : 'Import'}
        </button>
      </div>

      {/* Results */}
      {results && (
        <div className={`rounded-xl p-4 mb-6 text-sm ${
          results.notFound.length === 0
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
            : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
        }`}>
          <p className="font-medium">
            {results.updated} updated
            {results.notFound.length > 0 && `, ${results.notFound.length} not found`}
          </p>
          {results.notFound.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs opacity-80">
              {results.notFound.map((v, i) => <li key={i}>• {v}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Preview table */}
      {parsed && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Preview — {parsed.length} {parsed.length === 1 ? 'card' : 'cards'}
          </h2>
          {parsed.map((item, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
            >
              <div className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                {item.vietnamese}
              </div>
              <div className="flex flex-wrap gap-1">
                {item.breakdown.map((seg, j) => (
                  <span
                    key={j}
                    className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded"
                  >
                    {seg.vi} → {seg.en}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
