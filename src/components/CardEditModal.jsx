import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { CHUNK_COLORS } from '../lib/colors'

export default function CardEditModal({ card, onSave, onDelete, onClose }) {
  const [vietnamese, setVietnamese] = useState(card.vietnamese)
  const [english, setEnglish] = useState(card.english)
  const [segments, setSegments] = useState(card.breakdown || [])
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  async function handleDelete() {
    setDeleting(true)
    const { error } = await supabase.from('flashcards').delete().eq('id', card.id)
    if (!error) onDelete(card.id)
    setDeleting(false)
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-co-border dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-display font-semibold text-co-ink dark:text-gray-100">Edit card</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-co-muted hover:text-co-ink hover:bg-co-surface dark:hover:bg-gray-800 text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-co-muted dark:text-gray-400 uppercase tracking-widest">
              Vietnamese
            </label>
            <input
              className="w-full border border-co-border dark:border-gray-700 rounded-xl px-3 py-2 text-base bg-white dark:bg-gray-800 text-co-ink dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-co-primary"
              value={vietnamese}
              onChange={e => setVietnamese(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-co-muted dark:text-gray-400 uppercase tracking-widest">
              English
            </label>
            <input
              className="w-full border border-co-border dark:border-gray-700 rounded-xl px-3 py-2 text-base bg-white dark:bg-gray-800 text-co-ink dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-co-primary"
              value={english}
              onChange={e => setEnglish(e.target.value)}
            />
          </div>

          {/* Breakdown segments */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-co-muted dark:text-gray-400 uppercase tracking-widest">
              Breakdown
            </div>
            {segments.length === 0 && (
              <p className="text-sm text-co-muted dark:text-gray-600">No breakdown yet.</p>
            )}
            {segments.map((seg, i) => {
              const color = CHUNK_COLORS[i % CHUNK_COLORS.length]
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-sm flex-shrink-0 ${color.swatch}`} />
                  <input
                    className="flex-1 border border-co-border dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-co-ink dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-co-primary"
                    value={seg.vi}
                    onChange={e => updateSegment(i, 'vi', e.target.value)}
                    placeholder="Vietnamese"
                  />
                  <input
                    className="flex-1 border border-co-border dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-co-ink dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-co-primary"
                    value={seg.en}
                    onChange={e => updateSegment(i, 'en', e.target.value)}
                    placeholder="English"
                  />
                  <button
                    onClick={() => deleteSegment(i)}
                    className="w-6 h-6 flex items-center justify-center flex-shrink-0 text-co-muted hover:text-red-500 transition-colors text-lg leading-none"
                    aria-label="Delete segment"
                  >
                    ×
                  </button>
                </div>
              )
            })}
            <button
              onClick={addSegment}
              className="text-sm text-co-primary font-semibold hover:underline"
            >
              + Add segment
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-co-border dark:border-gray-700">
          {confirmDelete ? (
            <div className="flex items-center gap-3">
              <span className="flex-1 text-sm text-co-muted dark:text-gray-400">Delete this card?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-500 text-white rounded-full font-semibold text-sm disabled:opacity-50 hover:scale-105 active:scale-95 transition-all"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="px-4 py-2 text-co-muted font-semibold text-sm"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-sm text-red-400 hover:text-red-600 font-semibold px-1 transition-colors"
              >
                Delete
              </button>
              <div className="flex-1 flex gap-3 justify-end">
                <button
                  onClick={onClose}
                  disabled={saving}
                  className="px-5 py-2.5 text-co-muted dark:text-gray-400 font-semibold hover:text-co-ink dark:hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 bg-co-primary text-white rounded-full font-semibold disabled:opacity-50 hover:scale-105 active:scale-95 transition-all duration-150"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
