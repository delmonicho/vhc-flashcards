import { useState } from 'react'
import { translateToEnglish } from '../lib/translate'
import { supabase } from '../lib/supabase'
import { getOrCreateBreakdown } from '../lib/breakdown'
import { addCategory, getCategoryColor } from '../lib/categories'

export default function VocabInput({ weekId, onCardCreated, onCardBreakdownReady, categories = [], onCategoriesChange }) {
  const [source, setSource] = useState('class')
  const [input, setInput] = useState('')
  const [state, setState] = useState('idle') // idle | loading | preview | error
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryLabel, setNewCategoryLabel] = useState('')

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
      setError(err.message)
      setState('error')
    }
  }

  async function handleConfirm() {
    setSaving(true)
    const { data, error } = await supabase
      .from('flashcards')
      .insert({
        week_id: weekId,
        vietnamese: preview.vietnamese,
        english: preview.english,
        source,
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
      // Generate breakdown in background — card appears immediately
      getOrCreateBreakdown(data.vietnamese, data.id)
        .then(breakdown => onCardBreakdownReady?.(data.id, breakdown))
        .catch(err => console.error('Breakdown generation failed:', err))
    } else {
      setError(error?.message || 'Failed to save card')
      setState('error')
    }
  }

  function handleCancel() {
    setPreview(null)
    setState('idle')
  }

  function handleAddCategory() {
    const label = newCategoryLabel.trim()
    if (!label) return
    const updated = addCategory(categories, label)
    onCategoriesChange?.(updated)
    setSource(updated[updated.length - 1].id)
    setAddingCategory(false)
    setNewCategoryLabel('')
  }

  return (
    <div className="bg-co-surface dark:bg-gray-800/50 border border-co-border dark:border-gray-700 rounded-2xl p-4 space-y-4">
      {/* Source toggle */}
      <div className="flex gap-2 flex-wrap items-center">
        {categories.map(cat => {
          const isActive = source === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => setSource(cat.id)}
              style={isActive ? { backgroundColor: cat.color, color: '#2D1B12' } : {}}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-150 ${
                isActive
                  ? 'shadow-sm'
                  : 'bg-white dark:bg-gray-700 border border-co-border dark:border-gray-600 text-co-muted dark:text-gray-400'
              }`}
            >
              {cat.label}
            </button>
          )
        })}
        {!addingCategory ? (
          <button
            onClick={() => setAddingCategory(true)}
            className="w-7 h-7 rounded-full bg-white dark:bg-gray-700 border border-co-border dark:border-gray-600 text-co-muted dark:text-gray-400 hover:text-co-primary flex items-center justify-center text-lg leading-none transition-colors"
            aria-label="Add category"
          >
            +
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              className="border border-co-border dark:border-gray-500 rounded-full px-3 py-1 text-sm bg-white dark:bg-gray-700 text-co-ink dark:text-gray-100 focus:outline-none focus:border-co-primary w-28"
              placeholder="Name…"
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
              className="text-sm font-semibold text-co-primary disabled:opacity-40 hover:underline"
            >
              Save
            </button>
          </div>
        )}
      </div>

      {/* Input row */}
      {state !== 'preview' && (
        <div className="flex gap-2">
          <input
            className="flex-1 border border-co-border dark:border-gray-600 rounded-xl px-4 py-3 text-base bg-white dark:bg-gray-800 text-co-ink dark:text-gray-100 placeholder-co-muted dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-co-primary transition-shadow"
            placeholder="Type Vietnamese word or phrase…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && state === 'idle' && handleAdd()}
            disabled={state === 'loading'}
          />
          <button
            onClick={handleAdd}
            disabled={!input.trim() || state === 'loading'}
            className="bg-co-primary text-white px-5 py-3 rounded-xl font-semibold disabled:opacity-50 hover:scale-105 active:scale-95 transition-all duration-150 min-w-16"
          >
            {state === 'loading' ? '…' : 'Add'}
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
              className="w-full font-display text-lg font-semibold text-co-ink dark:text-gray-100 bg-white dark:bg-gray-700 border border-co-border dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-co-primary"
              value={preview.vietnamese}
              onChange={e => setPreview({ ...preview, vietnamese: e.target.value })}
            />
            <input
              className="w-full text-co-ink dark:text-gray-300 bg-white dark:bg-gray-700 border border-co-border dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-co-primary"
              value={preview.english}
              onChange={e => setPreview({ ...preview, english: e.target.value })}
            />
            <span
              className="inline-block text-xs px-2.5 py-0.5 rounded-full font-medium text-co-ink"
              style={{ backgroundColor: getCategoryColor(categories, source) }}
            >
              {source}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex-1 bg-co-primary text-white py-3 rounded-full font-semibold disabled:opacity-50 hover:scale-105 active:scale-95 transition-all duration-150"
            >
              {saving ? 'Saving…' : 'Confirm ✓'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-6 py-3 text-co-muted dark:text-gray-400 font-semibold hover:text-co-ink dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
