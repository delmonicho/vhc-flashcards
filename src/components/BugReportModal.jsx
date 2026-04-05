import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function BugReportModal({ currentPage, onClose }) {
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState('')
  const [status, setStatus] = useState('idle') // 'idle' | 'submitting' | 'success' | 'error'
  const modalRef = useRef(null)

  // Focus trap
  useEffect(() => {
    const modal = modalRef.current
    if (!modal) return
    const focusableSelectors = 'button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    function getFocusable() { return Array.from(modal.querySelectorAll(focusableSelectors)) }
    function handleKeyDown(e) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      const focusable = getFocusable()
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    const firstFocusable = getFocusable()[0]
    firstFocusable?.focus()
    modal.addEventListener('keydown', handleKeyDown)
    return () => modal.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Auto-close after success
  useEffect(() => {
    if (status !== 'success') return
    const t = setTimeout(onClose, 2000)
    return () => clearTimeout(t)
  }, [status, onClose])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!description.trim()) return
    setStatus('submitting')
    const { error } = await supabase.from('logs').insert({
      type: 'bug-report',
      page: currentPage,
      action: 'bug-report',
      message: description.trim(),
      details: {
        steps: steps.trim() || null,
        url: window.location.href,
        userAgent: navigator.userAgent,
      },
    })
    setStatus(error ? 'error' : 'success')
  }

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bug-modal-title"
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-co-border dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-lg" aria-hidden="true">🪲</span>
            <h2 id="bug-modal-title" className="font-display font-semibold text-co-ink dark:text-gray-100">
              Report a bug
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 flex items-center justify-center rounded-full text-co-muted hover:text-co-ink hover:bg-co-surface dark:hover:bg-gray-800 text-xl leading-none transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2"
          >
            ×
          </button>
        </div>

        {/* Body */}
        {status === 'success' ? (
          <div className="px-5 py-10 flex flex-col items-center gap-3 text-center">
            <span className="text-3xl" aria-hidden="true">✓</span>
            <p className="font-semibold text-co-ink dark:text-gray-100">Thanks! We'll look into it.</p>
            <p className="text-sm text-co-muted dark:text-gray-400">Closing in a moment…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="bug-description" className="block text-xs font-semibold text-co-muted dark:text-gray-400 uppercase tracking-widest">
                What went wrong? <span className="text-co-primary">*</span>
              </label>
              <textarea
                id="bug-description"
                rows={4}
                required
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe the bug…"
                className="w-full border border-co-border dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 text-co-ink dark:text-gray-100 placeholder-co-muted dark:placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-co-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="bug-steps" className="block text-xs font-semibold text-co-muted dark:text-gray-400 uppercase tracking-widest">
                Steps to reproduce <span className="text-co-muted dark:text-gray-500 normal-case tracking-normal font-normal">(optional)</span>
              </label>
              <textarea
                id="bug-steps"
                rows={3}
                value={steps}
                onChange={e => setSteps(e.target.value)}
                placeholder="1. Go to…&#10;2. Click on…&#10;3. See error"
                className="w-full border border-co-border dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 text-co-ink dark:text-gray-100 placeholder-co-muted dark:placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-co-primary"
              />
            </div>
            {status === 'error' && (
              <p role="alert" className="text-sm text-red-500 dark:text-red-400">
                Something went wrong. Please try again.
              </p>
            )}
            <div className="flex gap-3 justify-end pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={status === 'submitting'}
                className="px-5 py-2.5 text-co-muted dark:text-gray-400 font-semibold hover:text-co-ink dark:hover:text-gray-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === 'submitting' || !description.trim()}
                className="px-6 py-2.5 bg-co-primary text-white rounded-full font-semibold text-sm disabled:opacity-40 hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2"
              >
                {status === 'submitting' ? 'Sending…' : 'Send report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
