import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { extractPdfText, parseVocabPairs } from '../lib/pdfImport'
import { addCategory } from '../lib/categories'

// Stable display colors per tag name so they don't shift between renders
const TAG_COLORS = {
  vocabulary: '#D6EEFF',
  dialogue:   '#D6F5E3',
  poem:       '#EDE4FF',
  grammar:    '#FFF0C0',
  review:     '#FFE8D6',
  example:    '#D6F5E3',
  exercise:   '#FCE4EC',
}
function tagColor(tag) {
  return TAG_COLORS[tag] ?? '#F0F0F0'
}

export default function PdfImportModal({ deckId, categories, onCategoriesChange, onCardsImported, onClose }) {
  const { user } = useAuth()
  const [phase, setPhase] = useState('uploading') // uploading | review | importing | done | error
  const [processing, setProcessing] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const [edits, setEdits] = useState([])           // {vietnamese, english, tag}[]
  const [checked, setChecked] = useState([])
  const [suggestedTags, setSuggestedTags] = useState([])        // unique tags from Claude
  const [activeSuggestedTags, setActiveSuggestedTags] = useState(new Set()) // which ones to apply
  const [selectedCategories, setSelectedCategories] = useState(() =>
    categories.some(c => c.id === 'class') ? ['class'] : []
  )
  const [importedTotal, setImportedTotal] = useState(0)
  const [importedCards, setImportedCards] = useState([])
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef(null)

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3_145_728) {
      setErrorMsg('File is too large. Maximum size is 3MB.')
      setPhase('error')
      return
    }
    setProcessing(true)
    try {
      const text = await extractPdfText(file)
      const { pairs, suggestedTags: tags, truncated: wasTruncated } = await parseVocabPairs(text)
      setEdits(pairs.map(p => ({ vietnamese: p.vietnamese, english: p.english, tag: p.tag ?? null })))
      setChecked(pairs.map(() => true))
      setSuggestedTags(tags)
      setActiveSuggestedTags(new Set(tags)) // pre-select all
      setTruncated(wasTruncated)
      setPhase('review')
    } catch (err) {
      setErrorMsg(err.message ?? 'Failed to process PDF.')
      setPhase('error')
    } finally {
      setProcessing(false)
    }
  }

  function toggleCategory(id) {
    setSelectedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  function toggleSuggestedTag(tag) {
    setActiveSuggestedTags(prev => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
  }

  async function handleImport() {
    const toImport = edits.filter((_, i) => checked[i])
    setImportedTotal(toImport.length)
    setPhase('importing')

    // Create any suggested tag categories that don't exist yet
    let currentCats = [...categories]
    for (const tag of activeSuggestedTags) {
      if (!currentCats.some(c => c.id === tag)) {
        try {
          const newCat = await addCategory(currentCats, tag)
          currentCats = [...currentCats, newCat]
        } catch { /* skip if creation fails */ }
      }
    }
    if (currentCats.length !== categories.length) {
      onCategoriesChange(currentCats)
    }

    const rows = toImport.map(pair => ({
      deck_id: deckId,
      user_id: user.id,
      vietnamese: pair.vietnamese,
      english: pair.english,
      source: [
        ...selectedCategories,
        ...(pair.tag && activeSuggestedTags.has(pair.tag) ? [pair.tag] : []),
      ],
      status: 'new',
    }))

    const { data } = await supabase.from('flashcards').insert(rows).select()
    const results = data ?? []
    setImportedCards(results)
    setPhase('done')
    onCardsImported(results)
  }

  function handleRetry() {
    setPhase('uploading')
    setProcessing(false)
    setErrorMsg('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    setTimeout(() => fileInputRef.current?.click(), 0)
  }

  const selectedCount = checked.filter(Boolean).length
  const allChecked = checked.length > 0 && checked.every(Boolean)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import flashcards from PDF"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget && phase !== 'importing') onClose() }}
    >
      <div className="w-full sm:max-w-lg bg-white dark:bg-gray-900 rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-co-border dark:border-gray-700 shrink-0">
          <h2 className="font-display text-lg font-bold text-co-ink dark:text-gray-100">
            Import from PDF
          </h2>
          {phase !== 'importing' && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 flex items-center justify-center rounded-full text-co-muted dark:text-gray-400 hover:text-co-ink dark:hover:text-gray-200 hover:bg-co-surface dark:hover:bg-gray-800 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 text-xl leading-none"
            >
              ×
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">

          {/* uploading phase */}
          {phase === 'uploading' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="sr-only"
                aria-label="Select PDF file"
              />
              {processing ? (
                <>
                  <div className="flex gap-2" aria-hidden="true">
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                  </div>
                  <p className="text-sm text-co-muted dark:text-gray-400">Extracting vocabulary…</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-co-surface dark:bg-gray-800 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-co-muted dark:text-gray-400" aria-hidden="true">
                      <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625z" />
                      <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-co-ink dark:text-gray-100 mb-1">Select a PDF file</p>
                    <p className="text-xs text-co-muted dark:text-gray-400">Max 3MB</p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-5 py-2.5 bg-co-primary text-white rounded-full font-semibold text-sm hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2"
                  >
                    Choose PDF
                  </button>
                </>
              )}
            </div>
          )}

          {/* review phase */}
          {phase === 'review' && (
            <>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-co-ink dark:text-gray-100 text-sm">
                    Found {edits.length} vocabulary pair{edits.length !== 1 ? 's' : ''}
                  </h3>
                  <button
                    onClick={() => setChecked(checked.map(() => !allChecked))}
                    className="text-xs text-co-primary hover:underline cursor-pointer focus:outline-none focus:ring-1 focus:ring-co-primary rounded"
                  >
                    {allChecked ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                {truncated && (
                  <p className="text-xs text-co-gold dark:text-yellow-400 bg-co-gold/10 dark:bg-yellow-900/20 rounded-xl px-3 py-2 mt-2">
                    PDF was very long — only the first portion was analyzed.
                  </p>
                )}
              </div>

              {/* Bulk category selector */}
              {categories.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-co-muted dark:text-gray-400 uppercase tracking-widest mb-2">Tag all as:</p>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => {
                      const active = selectedCategories.includes(cat.id)
                      return (
                        <button
                          key={cat.id}
                          onClick={() => toggleCategory(cat.id)}
                          style={active ? { backgroundColor: cat.color, color: '#2D1B12' } : {}}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-1 ${
                            active
                              ? 'shadow-sm'
                              : 'bg-co-surface dark:bg-gray-800 text-co-muted dark:text-gray-400 hover:text-co-ink dark:hover:text-gray-200'
                          }`}
                        >
                          {cat.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Suggested section tags */}
              {suggestedTags.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-co-muted dark:text-gray-400 uppercase tracking-widest mb-2">Also tag by section:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedTags.map(tag => {
                      const active = activeSuggestedTags.has(tag)
                      return (
                        <button
                          key={tag}
                          onClick={() => toggleSuggestedTag(tag)}
                          style={active ? { backgroundColor: tagColor(tag), color: '#2D1B12' } : {}}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-1 ${
                            active
                              ? 'shadow-sm'
                              : 'bg-co-surface dark:bg-gray-800 text-co-muted dark:text-gray-400 hover:text-co-ink dark:hover:text-gray-200'
                          }`}
                        >
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-co-muted dark:text-gray-500 mt-1.5">Applied per card based on its section. New tags are created automatically.</p>
                </div>
              )}

              {/* Pairs list */}
              <div className="space-y-2">
                {edits.map((edit, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                      checked[i]
                        ? 'border-co-border dark:border-gray-700 bg-white dark:bg-gray-800/50'
                        : 'border-transparent bg-co-surface/50 dark:bg-gray-800/20 opacity-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked[i]}
                      onChange={e => {
                        const next = [...checked]
                        next[i] = e.target.checked
                        setChecked(next)
                      }}
                      className="mt-1 w-4 h-4 accent-co-primary cursor-pointer shrink-0"
                      aria-label={`Include ${edit.vietnamese}`}
                    />
                    <div className="flex-1 grid grid-cols-2 gap-2 min-w-0">
                      <input
                        type="text"
                        value={edit.vietnamese}
                        lang="vi"
                        onChange={e => {
                          const next = [...edits]
                          next[i] = { ...next[i], vietnamese: e.target.value }
                          setEdits(next)
                        }}
                        className="text-sm font-semibold font-display text-co-ink dark:text-gray-100 bg-transparent border-b border-transparent hover:border-co-border dark:hover:border-gray-600 focus:border-co-primary focus:outline-none py-0.5 w-full min-w-0"
                        aria-label="Vietnamese"
                      />
                      <input
                        type="text"
                        value={edit.english}
                        onChange={e => {
                          const next = [...edits]
                          next[i] = { ...next[i], english: e.target.value }
                          setEdits(next)
                        }}
                        className="text-sm text-co-muted dark:text-gray-300 bg-transparent border-b border-transparent hover:border-co-border dark:hover:border-gray-600 focus:border-co-primary focus:outline-none py-0.5 w-full min-w-0"
                        aria-label="English"
                      />
                    </div>
                    {edit.tag && (
                      <span
                        className="shrink-0 self-center text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: activeSuggestedTags.has(edit.tag) ? tagColor(edit.tag) : '#F0F0F0',
                          color: '#2D1B12',
                          opacity: activeSuggestedTags.has(edit.tag) ? 1 : 0.4,
                        }}
                        aria-label={`Section: ${edit.tag}`}
                      >
                        {edit.tag}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* importing phase */}
          {phase === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="flex gap-2" aria-hidden="true">
                <span className="loading-dot" />
                <span className="loading-dot" />
                <span className="loading-dot" />
              </div>
              <p
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="text-sm font-semibold text-co-ink dark:text-gray-100"
              >
                Importing {importedTotal} cards…
              </p>
            </div>
          )}

          {/* done phase */}
          {phase === 'done' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <div className="w-16 h-16 rounded-full bg-co-fern/10 dark:bg-co-fern/20 flex items-center justify-center text-co-fern dark:text-green-400 text-2xl font-bold">
                ✓
              </div>
              <p className="font-semibold text-co-ink dark:text-gray-100">
                Imported {importedCards.length} card{importedCards.length !== 1 ? 's' : ''}
              </p>
              {importedCards.length < importedTotal && (
                <p className="text-xs text-co-muted dark:text-gray-400">
                  {importedTotal - importedCards.length} card{importedTotal - importedCards.length !== 1 ? 's' : ''} skipped due to errors.
                </p>
              )}
            </div>
          )}

          {/* error phase */}
          {phase === 'error' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="sr-only"
                aria-label="Select PDF file"
              />
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center text-red-500 dark:text-red-400 text-2xl font-bold">
                !
              </div>
              <div>
                <p className="text-sm font-semibold text-co-ink dark:text-gray-100 mb-1">Something went wrong</p>
                <p className="text-sm text-co-muted dark:text-gray-400">{errorMsg}</p>
              </div>
              <button
                onClick={handleRetry}
                className="px-5 py-2.5 bg-co-primary text-white rounded-full font-semibold text-sm hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {phase === 'review' && (
          <div className="px-6 py-4 border-t border-co-border dark:border-gray-700 flex items-center justify-between gap-3 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-full text-sm font-semibold text-co-muted dark:text-gray-400 hover:text-co-ink dark:hover:text-gray-200 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={selectedCount === 0}
              className="px-5 py-2.5 bg-co-primary text-white rounded-full font-semibold text-sm disabled:opacity-40 hover:enabled:scale-105 active:enabled:scale-95 transition-all cursor-pointer disabled:cursor-default focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2"
            >
              Import {selectedCount} card{selectedCount !== 1 ? 's' : ''}
            </button>
          </div>
        )}
        {phase === 'done' && (
          <div className="px-6 py-4 border-t border-co-border dark:border-gray-700 flex justify-end shrink-0">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-co-primary text-white rounded-full font-semibold text-sm hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
