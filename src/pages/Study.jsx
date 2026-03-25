import { useState, useEffect } from 'react'
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
    <div className="text-center leading-relaxed">
      {breakdown.map((seg, i) => {
        const colorClass = CHUNK_COLORS[i % CHUNK_COLORS.length].pill
        const active = speakingKey === `chunk-${i}`
        if (interactive) {
          return (
            <button
              key={i}
              onClick={() => onSpeak(i, seg.vi)}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 mx-0.5 my-0.5 text-sm font-medium min-h-[2.75rem] active:opacity-70 transition-opacity ${colorClass}`}
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
            className={`inline-block rounded-lg px-2.5 py-1 mx-0.5 my-0.5 text-sm font-medium ${colorClass}`}
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

  if (loading) return <LoadingDots />

  if (cards.length === 0) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center py-12 space-y-4">
        <p className="text-co-muted dark:text-gray-400">No cards to study yet.</p>
        <button
          onClick={() => onNavigate('week', weekId)}
          className="text-co-primary font-semibold"
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
          className="w-9 h-9 flex items-center justify-center rounded-full text-co-muted dark:text-gray-400 hover:text-co-primary hover:bg-co-surface dark:hover:bg-gray-800 transition-all text-xl leading-none"
          aria-label="Back to week"
        >
          ←
        </button>
        <div className="flex-1">
          <div className="text-sm text-co-muted dark:text-gray-400 mb-1.5">
            {index + 1} / {cards.length}
          </div>
          <div className="h-2 bg-co-border dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress * 100}%`,
                background: 'linear-gradient(to right, #E8526A, #F5A623)',
              }}
            />
          </div>
        </div>
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
            className="text-co-muted hover:text-co-ink ml-1 leading-none text-lg"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Flashcard */}
      <div
        onClick={() => setFlipped(f => !f)}
        className={`relative w-full rounded-3xl cursor-pointer shadow-lg transition-colors duration-300 overflow-hidden ${
          flipped
            ? 'bg-co-navy dark:bg-co-navy'
            : 'bg-co-surface dark:bg-gray-800'
        }`}
        style={{ minHeight: '14rem' }}
      >
        <div key={String(flipped)} className="flip-in p-8">
          {flipped ? (
            /* Back face */
            <div onClick={e => e.stopPropagation()}>
              {card.breakdown ? (
                <>
                  <InlineChunks
                    breakdown={card.breakdown}
                    field="vi"
                    onSpeak={(i, text) => handleSpeak(`chunk-${i}`, text)}
                    speakingKey={speakingKey}
                  />
                  <div className="border-t border-white/15 my-4" />
                  <InlineChunks
                    breakdown={card.breakdown}
                    field="en"
                    speakingKey={speakingKey}
                  />
                  <button
                    onClick={() => handleSpeak('full', card.vietnamese, 1)}
                    className="mt-4 flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mx-auto"
                  >
                    <SpeakerIcon active={speakingKey === 'full'} />
                    Hear full phrase
                  </button>
                </>
              ) : (
                <>
                  <div className="text-xs text-white/40 text-center mb-3 font-medium uppercase tracking-widest">
                    {card.vietnamese}
                  </div>
                  <div className="text-xl text-white/95 text-center border-t border-white/15 pt-4">
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
          className={`absolute bottom-4 right-4 w-11 h-11 flex items-center justify-center rounded-full transition-all ${
            flipped
              ? 'text-white/50 hover:text-white/90 hover:bg-white/10'
              : 'text-co-primary/60 hover:text-co-primary hover:bg-co-primary/10'
          }`}
          aria-label="Pronounce Vietnamese"
        >
          <SpeakerIcon active={speakingKey === 'card'} />
        </button>
      </div>

      {/* Navigation arrows */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="w-14 h-14 flex items-center justify-center rounded-2xl border-2 border-co-border dark:border-gray-700 text-co-muted dark:text-gray-400 disabled:opacity-30 hover:border-co-primary hover:text-co-primary dark:hover:border-co-primary dark:hover:text-co-primary active:bg-co-surface dark:active:bg-gray-800 transition-all duration-150 text-2xl"
          aria-label="Previous card"
        >
          ‹
        </button>
        <button
          onClick={() => goTo(index + 1)}
          disabled={index === cards.length - 1}
          className="w-14 h-14 flex items-center justify-center rounded-2xl border-2 border-co-border dark:border-gray-700 text-co-muted dark:text-gray-400 disabled:opacity-30 hover:border-co-primary hover:text-co-primary dark:hover:border-co-primary dark:hover:text-co-primary active:bg-co-surface dark:active:bg-gray-800 transition-all duration-150 text-2xl"
          aria-label="Next card"
        >
          ›
        </button>
      </div>
    </div>
  )
}
