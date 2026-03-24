import { useState } from 'react'
import { translateToEnglish } from '../lib/translate'
import { supabase } from '../lib/supabase'

export default function VocabInput({ weekId, onCardCreated }) {
  const [source, setSource] = useState('class')
  const [input, setInput] = useState('')
  const [state, setState] = useState('idle') // idle | loading | preview | error
  const [preview, setPreview] = useState(null) // { vietnamese, english }
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

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
    } else {
      setError(error?.message || 'Failed to save card')
      setState('error')
    }
  }

  function handleCancel() {
    setPreview(null)
    setState('idle')
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
      {/* Source toggle */}
      <div className="flex gap-2">
        {['class', 'homework'].map(s => (
          <button
            key={s}
            onClick={() => setSource(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              source === s
                ? s === 'class'
                  ? 'bg-blue-600 text-white'
                  : 'bg-orange-500 text-white'
                : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
            }`}
          >
            {s === 'class' ? 'Class' : 'Homework'}
          </button>
        ))}
      </div>

      {/* Input row */}
      {state !== 'preview' && (
        <div className="flex gap-2">
          <input
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Type Vietnamese word or phrase…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && state === 'idle' && handleAdd()}
            disabled={state === 'loading'}
          />
          <button
            onClick={handleAdd}
            disabled={!input.trim() || state === 'loading'}
            className="bg-blue-600 text-white px-5 py-3 rounded-lg font-medium disabled:opacity-50 active:bg-blue-700 min-w-20"
          >
            {state === 'loading' ? '…' : 'Add'}
          </button>
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      )}

      {/* Preview */}
      {state === 'preview' && preview && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-2">
            <input
              className="w-full text-lg font-semibold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={preview.vietnamese}
              onChange={e => setPreview({ ...preview, vietnamese: e.target.value })}
            />
            <input
              className="w-full text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={preview.english}
              onChange={e => setPreview({ ...preview, english: e.target.value })}
            />
            <span
              className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                source === 'class'
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                  : 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300'
              }`}
            >
              {source}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium disabled:opacity-50 active:bg-green-700"
            >
              {saving ? 'Saving…' : 'Confirm ✓'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-3 rounded-lg font-medium active:bg-gray-50 dark:active:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
