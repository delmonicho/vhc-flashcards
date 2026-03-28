import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import ThemeToggle from '../components/ThemeToggle'
import { CHUNK_COLORS } from '../lib/colors'
import { speakVietnamese, cancelSpeech, isVietnameseVoiceAvailable } from '../lib/speak'

const BANNER_KEY = 'viVoiceBannerDismissed'
function SpeakerIcon({ active }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`w-5 h-5 ${active ? 'animate-pulse' : ''}`}
      aria-hidden="true"
    >
      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.241 1.518 1.905 2.659 1.905H6.44l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
      <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
    </svg>
  )
}

function GridIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
      <path fillRule="evenodd" d="M3 6a3 3 0 013-3h2.25a3 3 0 013 3v2.25a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm9.75 0a3 3 0 013-3H18a3 3 0 013 3v2.25a3 3 0 01-3 3h-2.25a3 3 0 01-3-3V6zM3 15.75a3 3 0 013-3h2.25a3 3 0 013 3V18a3 3 0 01-3 3H6a3 3 0 01-3-3v-2.25zm9.75 0a3 3 0 013-3H18a3 3 0 013 3V18a3 3 0 01-3 3h-2.25a3 3 0 01-3-3v-2.25z" clipRule="evenodd" />
    </svg>
  )
}

function LoadingDots() {
  return (
    <div className="flex justify-center gap-2 py-20">
      <span className="loading-dot" />
      <span className="loading-dot" />
      <span className="loading-dot" />
    </div>
  )
}

function InlineChunks({ breakdown, field, onSpeak, speakingKey }) {
  const interactive = field === 'vi' && !!onSpeak
  return (
    <div className="w-full text-center leading-relaxed">
      {breakdown.map((seg, i) => {
        const colorClass = CHUNK_COLORS[i % CHUNK_COLORS.length].pill
        const active = speakingKey === `chunk-${i}`
        if (interactive) {
          return (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); onSpeak(i, seg.vi) }}
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 mx-0.5 my-0.5 text-base font-semibold active:opacity-70 transition-opacity cursor-pointer ${colorClass}`}
            >
              {seg[field]}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className={`w-3 h-3 shrink-0 ${active ? 'animate-pulse' : ''}`}
                aria-hidden="true"
              >
                <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.241 1.518 1.905 2.659 1.905H6.44l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
              </svg>
            </button>
          )
        }
        return (
          <span
            key={i}
            className={`inline-block rounded-md px-1.5 py-0.5 mx-0.5 my-0.5 text-base font-semibold ${colorClass}`}
          >
            {seg[field]}
          </span>
        )
      })}
    </div>
  )
}

export default function Study({ weekId, onNavigate, dark, onToggleDark }) {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [speakingKey, setSpeakingKey] = useState(null)
  const [showVoiceBanner, setShowVoiceBanner] = useState(false)
  const [gridView, setGridView] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const touchStartX = useRef(null)
  const sliderRef = useRef(null)
  const isDragging = useRef(false)

  useEffect(() => {
    supabase
      .from('flashcards')
      .select('*')
      .eq('week_id', weekId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setCards(data || [])
        setLoading(false)
      })
  }, [weekId])

  useEffect(() => {
    if (localStorage.getItem(BANNER_KEY)) return
    const check = () => {
      if (!isVietnameseVoiceAvailable()) setShowVoiceBanner(true)
    }
    check()
    const timer = setTimeout(check, 600)
    return () => clearTimeout(timer)
  }, [])

  // Show hint briefly when cards first load
  useEffect(() => {
    if (cards.length === 0) return
    setShowHint(true)
    const timer = setTimeout(() => setShowHint(false), 3000)
    return () => clearTimeout(timer)
  }, [cards.length])

  // Option A: Keyboard navigation
  useEffect(() => {
    if (gridView || cards.length === 0) return
    function handleKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') { if (index > 0) goTo(index - 1) }
      else if (e.key === 'ArrowRight') { if (index < cards.length - 1) goTo(index + 1) }
      else if (e.key === ' ') { e.preventDefault(); setFlipped(f => !f) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [index, cards.length, gridView])

  function goTo(newIndex) {
    cancelSpeech()
    setSpeakingKey(null)
    setIndex(newIndex)
    setFlipped(false)
  }

  function dismissBanner() {
    localStorage.setItem(BANNER_KEY, '1')
    setShowVoiceBanner(false)
  }

  async function handleSpeak(key, text, rate = 0.8) {
    if (speakingKey === key) {
      cancelSpeech()
      setSpeakingKey(null)
      return
    }
    setSpeakingKey(key)
    try {
      await speakVietnamese(text, { rate })
    } finally {
      setSpeakingKey(null)
    }
  }

  // Option A: Touch swipe handlers
  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < 50) return
    if (dx < 0 && index < cards.length - 1) goTo(index + 1)
    else if (dx > 0 && index > 0) goTo(index - 1)
  }

  // Option B: Slider — shared index calculation
  function indexFromClientX(clientX) {
    const rect = sliderRef.current?.getBoundingClientRect()
    if (!rect) return index
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.min(Math.floor(fraction * cards.length), cards.length - 1)
  }

  function handleSliderPointerDown(e) {
    e.preventDefault()
    isDragging.current = true
    sliderRef.current.setPointerCapture(e.pointerId)
    cancelSpeech()
    setSpeakingKey(null)
    setFlipped(false)
    setIndex(indexFromClientX(e.clientX))
  }

  function handleSliderPointerMove(e) {
    if (!isDragging.current) return
    setIndex(indexFromClientX(e.clientX))
  }

  function handleSliderPointerUp() {
    isDragging.current = false
  }

  if (loading) return <LoadingDots />

  if (cards.length === 0) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center py-12 space-y-4">
        <p className="text-co-muted dark:text-gray-400">No cards to study yet.</p>
        <button
          onClick={() => onNavigate('week', weekId)}
          className="text-co-primary font-semibold cursor-pointer"
        >
          ← Back to week
        </button>
      </div>
    )
  }

  const card = cards[index]
  const progress = (index + 1) / cards.length

  return (
    <div className="page-fade-in max-w-lg mx-auto px-4 py-6 md:px-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => onNavigate('week', weekId)}
          className="w-9 h-9 flex items-center justify-center rounded-full text-co-muted dark:text-gray-400 hover:text-co-primary hover:bg-co-surface dark:hover:bg-gray-800 transition-all text-xl leading-none cursor-pointer"
          aria-label="Back to week"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-sm text-co-muted dark:text-gray-400">
              {index + 1} / {cards.length}
            </div>
          </div>
          {/* Option B: Draggable scrubber slider */}
          <div
            ref={sliderRef}
            onPointerDown={handleSliderPointerDown}
            onPointerMove={handleSliderPointerMove}
            onPointerUp={handleSliderPointerUp}
            onPointerCancel={handleSliderPointerUp}
            role="slider"
            aria-label="Navigate cards"
            aria-valuemin={1}
            aria-valuemax={cards.length}
            aria-valuenow={index + 1}
            className="w-full relative flex items-center py-2 cursor-grab active:cursor-grabbing touch-none select-none"
          >
            <div className="w-full h-2 bg-co-border dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progress * 100}%`,
                  background: 'linear-gradient(to right, #E8526A, #F5A623)',
                }}
              />
            </div>
            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full shadow-md pointer-events-none ring-2 ring-white dark:ring-gray-900"
              style={{
                left: `${progress * 100}%`,
                background: 'linear-gradient(to right, #E8526A, #F5A623)',
              }}
            />
          </div>
        </div>

        {/* Option C: Grid view toggle */}
        <button
          onClick={() => setGridView(v => !v)}
          className={`w-9 h-9 flex items-center justify-center rounded-full transition-all cursor-pointer ${
            gridView
              ? 'text-co-primary bg-co-primary/10 dark:bg-co-primary/20'
              : 'text-co-muted dark:text-gray-400 hover:text-co-primary hover:bg-co-surface dark:hover:bg-gray-800'
          }`}
          aria-label={gridView ? 'Exit overview' : 'Card overview'}
        >
          <GridIcon />
        </button>

        <ThemeToggle dark={dark} onToggle={onToggleDark} />
      </div>

      {/* No Vietnamese voice banner */}
      {showVoiceBanner && (
        <div className="flex items-start gap-3 bg-co-cream dark:bg-amber-900/20 border border-co-gold/40 rounded-2xl px-4 py-3 mb-4 text-sm text-co-ink dark:text-amber-300">
          <span className="flex-1">
            No Vietnamese voice found. For best results on iPad, go to{' '}
            <strong>Settings → Accessibility → Spoken Content → Voices → Vietnamese</strong>.
          </span>
          <button
            onClick={dismissBanner}
            className="text-co-muted hover:text-co-ink ml-1 leading-none text-lg cursor-pointer"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Option C: Grid overview */}
      {gridView ? (
        <div className="page-fade-in">
          <div className="grid grid-cols-3 gap-2">
            {cards.map((c, i) => (
              <button
                key={c.id}
                onClick={() => { goTo(i); setGridView(false) }}
                className={`rounded-2xl p-3 text-left transition-all active:scale-95 cursor-pointer ${
                  i === index
                    ? 'bg-co-primary/10 dark:bg-co-primary/20 ring-2 ring-co-primary'
                    : 'bg-co-surface dark:bg-gray-800 hover:bg-co-border/40 dark:hover:bg-gray-700'
                }`}
              >
                <div className="text-sm font-semibold text-co-ink dark:text-gray-100 line-clamp-2 leading-snug">
                  {c.vietnamese}
                </div>
                {c.source && (
                  <div className={`mt-1.5 text-xs font-medium ${
                    c.source === 'class' ? 'text-co-primary' : 'text-teal-500 dark:text-teal-400'
                  }`}>
                    {c.source === 'class' ? 'Class' : 'HW'}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Flashcard — with Option A swipe handlers */
        <div className="relative">
          <div
            onClick={() => setFlipped(f => !f)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className={`relative w-full rounded-3xl cursor-pointer shadow-lg transition-colors duration-300 overflow-hidden ${
              flipped
                ? 'bg-co-surface dark:bg-co-navy'
                : 'bg-co-surface dark:bg-gray-800'
            }`}
            style={{ minHeight: '14rem' }}
          >
            <div key={String(flipped)} className="flip-in p-8">
              {flipped ? (
                /* Back face */
                <div className="flex flex-col items-center justify-center min-h-[10rem]">
                  {card.breakdown ? (
                    <div className="w-full flex flex-col items-center">
                      <InlineChunks
                        breakdown={card.breakdown}
                        field="vi"
                        onSpeak={(i, text) => handleSpeak(`chunk-${i}`, text)}
                        speakingKey={speakingKey}
                      />
                      <div className="w-4/5 border-t border-co-border dark:border-white/15 my-4" />
                      <InlineChunks
                        breakdown={card.breakdown}
                        field="en"
                        speakingKey={speakingKey}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="text-xs text-co-muted dark:text-white/40 text-center mb-3 font-medium uppercase tracking-widest">
                        {card.vietnamese}
                      </div>
                      <div className="text-xl text-co-ink dark:text-white/95 text-center border-t border-co-border dark:border-white/15 pt-4">
                        {card.english}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* Front face */
                <div className="flex flex-col items-center justify-center min-h-[8rem] text-center">
                  <div className="font-display text-2xl font-bold text-co-ink dark:text-gray-100 mb-4">
                    {card.vietnamese}
                  </div>
                  <div className="text-sm text-co-muted dark:text-gray-500">
                    tap to reveal
                  </div>
                </div>
              )}
            </div>

            {/* Speaker button */}
            <button
              onClick={e => {
                e.stopPropagation()
                handleSpeak('card', card.vietnamese)
              }}
              className={`absolute bottom-4 right-4 w-11 h-11 flex items-center justify-center rounded-full transition-all cursor-pointer ${
                flipped
                  ? 'text-co-primary/60 hover:text-co-primary hover:bg-co-primary/10 dark:text-white/50 dark:hover:text-white/90 dark:hover:bg-white/10'
                  : 'text-co-primary/60 hover:text-co-primary hover:bg-co-primary/10'
              }`}
              aria-label="Pronounce Vietnamese"
            >
              <SpeakerIcon active={speakingKey === 'card'} />
            </button>

            {/* Navigation arrows */}
            <button
              onClick={e => { e.stopPropagation(); goTo(index - 1) }}
              disabled={index === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-black/10 dark:bg-white/10 text-co-ink/50 dark:text-white/40 disabled:opacity-0 hover:bg-black/20 dark:hover:bg-white/20 hover:text-co-ink dark:hover:text-white active:scale-90 transition-all duration-150 text-3xl cursor-pointer"
              aria-label="Previous card"
            >
              ‹
            </button>
            <button
              onClick={e => { e.stopPropagation(); goTo(index + 1) }}
              disabled={index === cards.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-black/10 dark:bg-white/10 text-co-ink/50 dark:text-white/40 disabled:opacity-0 hover:bg-black/20 dark:hover:bg-white/20 hover:text-co-ink dark:hover:text-white active:scale-90 transition-all duration-150 text-3xl cursor-pointer"
              aria-label="Next card"
            >
              ›
            </button>
          </div>

          {/* Option A: Keyboard/swipe hint */}
          {showHint && (
            <div className="absolute -bottom-8 left-0 right-0 flex justify-center pointer-events-none">
              <span
                className="text-xs text-co-muted dark:text-gray-500 transition-opacity duration-500"
                style={{ opacity: showHint ? 0.8 : 0 }}
              >
                ← → to navigate · space to flip
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
