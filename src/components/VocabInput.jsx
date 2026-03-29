import { useState, useRef, useEffect } from 'react'
import { translateToEnglish } from '../lib/translate'
import { supabase } from '../lib/supabase'
import { getOrCreateBreakdown } from '../lib/breakdown'
import { addCategory, getCategoryColor } from '../lib/categories'
import { logError } from '../lib/logger'
import { useAuth } from '../context/AuthContext'

export default function VocabInput({ deckId, onCardCreated, onCardBreakdownReady, categories = [], onCategoriesChange }) {
  const { user } = useAuth()
  const [tags, setTags] = useState([])           // array of category ids (optional)
  const [input, setInput] = useState('')
  const [state, setState] = useState('idle')     // idle | loading | preview | error
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryLabel, setNewCategoryLabel] = useState('')
  const [showCatMenu, setShowCatMenu] = useState(false)
  const catMenuRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!showCatMenu) return
    function handleClick(e) {
      if (catMenuRef.current && !catMenuRef.current.contains(e.target)) {
        setShowCatMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showCatMenu])

  function toggleTag(catId) {
    setTags(prev =>
      prev.includes(catId) ? prev.filter(t => t !== catId) : [...prev, catId]
    )
  }

  function catButtonLabel() {
    if (tags.length === 0) return 'No tags'
    if (tags.length === 1) {
      return categories.find(c => c.id === tags[0])?.label ?? tags[0]
    }
    if (tags.length === 2) {
      return tags.map(id => categories.find(c => c.id === id)?.label ?? id).join(', ')
    }
    return `${tags.length} tags`
  }

  const firstTagColor = tags.length > 0
    ? categories.find(c => c.id === tags[0])?.color
    : null

  async function handleAdd() {
    const text = input.trim()
    if (!text) return
    setState('loading')
    setError('')
    try {
      const english = await translateToEnglish(text)
      setPreview({ vietnamese: text, english })
      setState('preview')
    } catch (err) {
      logError('Google Translate failed', { page: 'deck', action: 'translate', err, details: { text } })
      setError(err.message)
      setState('error')
    }
  }

  async function handleConfirm() {
    setSaving(true)
    const { data, error } = await supabase
      .from('flashcards')
      .insert({
        deck_id: deckId,
        user_id: user.id,
        vietnamese: preview.vietnamese,
        english: preview.english,
        source: tags,
        status: 'new',
        breakdown: null,
      })
      .select()
      .single()
    setSaving(false)
    if (!error && data) {
      onCardCreated(data)
      setInput('')
      setPreview(null)
      setState('idle')
      getOrCreateBreakdown(data.vietnamese, data.id, data.english)
        .then(breakdown => onCardBreakdownReady?.(data.id, breakdown))
        .catch(err => logError('Breakdown generation failed', { page: 'deck', action: 'breakdown', err, details: { cardId: data.id, vietnamese: data.vietnamese } }))
    } else {
      setError(error?.message || 'Failed to save card')
      setState('error')
    }
  }

  function handleCancel() {
    setPreview(null)
    setState('idle')
  }

  async function handleAddCategory() {
    const label = newCategoryLabel.trim()
    if (!label) return
    const newCat = await addCategory(categories, label)
    onCategoriesChange?.([...categories, newCat])
    setTags(prev => [...prev, newCat.id])
    setAddingCategory(false)
    setNewCategoryLabel('')
  }

  return (
    <div className="bg-co-surface dark:bg-gray-800/50 border border-co-border dark:border-gray-700 rounded-2xl p-4 space-y-3">
      {/* Input row with inline multi-select category dropdown */}
      {state !== 'preview' && (
        <div className="flex gap-2">
          <label htmlFor="vocab-input" className="sr-only">Type Vietnamese word or phrase</label>
          <input
            id="vocab-input"
            lang="vi"
            spellCheck="false"
            className="flex-1 border border-co-border dark:border-gray-600 rounded-xl px-4 py-3 text-base bg-white dark:bg-gray-800 text-co-ink dark:text-gray-100 placeholder-co-muted dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-co-primary transition-shadow"
            placeholder="Type Vietnamese word or phrase…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && state === 'idle' && handleAdd()}
            disabled={state === 'loading'}
          />

          {/* Category multi-select */}
          <div ref={catMenuRef} className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowCatMenu(v => !v)}
              aria-haspopup="listbox"
              aria-expanded={showCatMenu}
              aria-label={`Tags: ${catButtonLabel()}`}
              className="h-full px-3 rounded-xl border text-sm font-semibold flex items-center gap-1.5 bg-white dark:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-co-primary cursor-pointer"
              style={
                firstTagColor
                  ? { borderColor: '#d1d5db', borderLeftColor: firstTagColor, borderLeftWidth: 3, color: '#2D1B12' }
                  : { borderColor: '#d1d5db', color: '#9B7B6B' }
              }
            >
              <span className={tags.length === 0 ? 'dark:text-gray-500' : 'text-co-ink dark:text-gray-100'}>
                {catButtonLabel()}
              </span>
              <span className="text-co-muted dark:text-gray-500 text-xs">▾</span>
            </button>

            {showCatMenu && (
              <div
                role="listbox"
                aria-label="Select tags"
                aria-multiselectable="true"
                className="absolute right-0 top-full mt-2 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-co-border dark:border-gray-700 p-1.5 min-w-40 z-20"
              >
                {categories.map(cat => {
                  const selected = tags.includes(cat.id)
                  return (
                    <button
                      key={cat.id}
                      role="option"
                      aria-selected={selected}
                      onClick={() => toggleTag(cat.id)}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-sm font-semibold hover:bg-co-surface dark:hover:bg-gray-800 transition-colors text-co-ink dark:text-gray-100 cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      {cat.label}
                      {selected && <span className="ml-auto text-co-fern text-xs">✓</span>}
                    </button>
                  )
                })}
                <div className="border-t border-co-border dark:border-gray-700 my-1" />
                <button
                  onClick={() => { setAddingCategory(true); setShowCatMenu(false) }}
                  className="flex items-center gap-1.5 w-full text-left px-3 py-2 rounded-lg text-sm text-co-muted dark:text-gray-400 hover:text-co-ink dark:hover:text-gray-200 transition-colors cursor-pointer"
                >
                  + New category
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleAdd}
            disabled={!input.trim() || state === 'loading'}
            className="bg-co-primary text-white px-5 py-3 rounded-xl font-semibold disabled:opacity-50 enabled:hover:scale-105 active:scale-95 transition-all duration-150 min-w-16 cursor-pointer disabled:cursor-not-allowed disabled:scale-100"
          >
            {state === 'loading' ? '…' : 'Add'}
          </button>
        </div>
      )}

      {/* New category inline input */}
      {addingCategory && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            className="flex-1 border border-co-border dark:border-gray-500 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 text-co-ink dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-co-primary"
            placeholder="e.g. Phrases, Food, Grammar…"
            value={newCategoryLabel}
            onChange={e => setNewCategoryLabel(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAddCategory()
              if (e.key === 'Escape') { setAddingCategory(false); setNewCategoryLabel('') }
            }}
          />
          <button
            onClick={handleAddCategory}
            disabled={!newCategoryLabel.trim()}
            className="px-4 py-2 text-sm font-semibold text-co-primary disabled:opacity-40 hover:underline cursor-pointer"
          >
            Save
          </button>
          <button
            onClick={() => { setAddingCategory(false); setNewCategoryLabel('') }}
            className="px-2 py-2 text-sm text-co-muted dark:text-gray-400 hover:text-co-ink dark:hover:text-gray-200 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <p className="text-red-500 text-sm">{error}</p>
      )}

      {/* Preview */}
      {state === 'preview' && preview && (
        <div className="space-y-3">
          <div className="bg-co-cream dark:bg-gray-700/50 border border-co-gold/40 dark:border-gray-600 rounded-xl p-4 space-y-2">
            <div className="text-xs text-co-muted uppercase tracking-widest font-semibold mb-1">✨ Translation preview</div>
            <input
              lang="vi"
              spellCheck="false"
              className="w-full font-display text-lg font-semibold text-co-ink dark:text-gray-100 bg-white dark:bg-gray-700 border border-co-border dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-co-primary"
              value={preview.vietnamese}
              onChange={e => setPreview({ ...preview, vietnamese: e.target.value })}
            />
            <input
              className="w-full text-co-ink dark:text-gray-300 bg-white dark:bg-gray-700 border border-co-border dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-co-primary"
              value={preview.english}
              onChange={e => setPreview({ ...preview, english: e.target.value })}
            />
            {/* Selected tags preview */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {tags.map(id => (
                  <span
                    key={id}
                    className="text-xs px-2.5 py-0.5 rounded-full font-medium text-co-ink"
                    style={{ backgroundColor: getCategoryColor(categories, id) }}
                  >
                    {categories.find(c => c.id === id)?.label ?? id}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex-1 bg-co-primary text-white py-3 rounded-full font-semibold disabled:opacity-50 hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer"
            >
              {saving ? 'Saving…' : 'Confirm ✓'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-6 py-3 text-co-muted dark:text-gray-400 font-semibold hover:text-co-ink dark:hover:text-gray-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
