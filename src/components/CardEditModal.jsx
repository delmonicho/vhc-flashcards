import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { CHUNK_COLORS } from '../lib/colors'

export default function CardEditModal({ card, onSave, onClose }) {
  const [vietnamese, setVietnamese] = useState(card.vietnamese)
  const [english, setEnglish] = useState(card.english)
  const [segments, setSegments] = useState(card.breakdown || [])
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const breakdown = segments.length > 0 ? segments : null
    const { error } = await supabase
      .from('flashcards')
      .update({ vietnamese, english, breakdown })
      .eq('id', card.id)
    if (!error) {
      onSave({ ...card, vietnamese, english, breakdown })
    }
    setSaving(false)
  }

  function updateSegment(i, field, value) {
    setSegments(prev => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)))
  }

  function deleteSegment(i) {
    setSegments(prev => prev.filter((_, idx) => idx !== i))
  }

  function addSegment() {
    setSegments(prev => [...prev, { vi: '', en: '' }])
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Edit card</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Main text */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Vietnamese
            </label>
            <input
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={vietnamese}
              onChange={e => setVietnamese(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              English
            </label>
            <input
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={english}
              onChange={e => setEnglish(e.target.value)}
            />
          </div>

          {/* Breakdown segments */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Breakdown
            </div>
            {segments.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-600">No breakdown yet.</p>
            )}
            {segments.map((seg, i) => {
              const color = CHUNK_COLORS[i % CHUNK_COLORS.length]
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-sm flex-shrink-0 ${color.swatch}`} />
                  <input
                    className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={seg.vi}
                    onChange={e => updateSegment(i, 'vi', e.target.value)}
                    placeholder="Vietnamese"
                  />
                  <input
                    className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={seg.en}
                    onChange={e => updateSegment(i, 'en', e.target.value)}
                    placeholder="English"
                  />
                  <button
                    onClick={() => deleteSegment(i)}
                    className="w-6 h-6 flex items-center justify-center flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors text-lg leading-none"
                    aria-label="Delete segment"
                  >
                    ×
                  </button>
                </div>
              )
            })}
            <button
              onClick={addSegment}
              className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline"
            >
              + Add segment
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium disabled:opacity-50 active:bg-blue-700"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-2.5 rounded-lg font-medium active:bg-gray-50 dark:active:bg-gray-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
