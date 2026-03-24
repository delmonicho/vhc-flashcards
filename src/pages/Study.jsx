import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ThemeToggle from '../components/ThemeToggle'
import BreakdownDisplay from '../components/BreakdownDisplay'
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

  // Check for Vietnamese voice availability — voices may load async
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

  if (loading) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center text-gray-500 dark:text-gray-400 py-12">
        Loading…
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center py-12 space-y-4">
        <p className="text-gray-500 dark:text-gray-400">No cards to study yet.</p>
        <button
          onClick={() => onNavigate('week', weekId)}
          className="text-blue-600 dark:text-blue-400 font-medium"
        >
          ← Back to week
        </button>
      </div>
    )
  }

  const card = cards[index]
  const progress = (index + 1) / cards.length

  return (
    <div className="max-w-lg mx-auto p-6">
      {/* Header + progress */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => onNavigate('week', weekId)}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-2xl leading-none"
          aria-label="Back to week"
        >
          ←
        </button>
        <div className="flex-1">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1.5">
            {index + 1} / {cards.length}
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
        <ThemeToggle dark={dark} onToggle={onToggleDark} />
      </div>

      {/* No Vietnamese voice banner */}
      {showVoiceBanner && (
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 mb-4 text-sm text-amber-800 dark:text-amber-300">
          <span className="flex-1">
            No Vietnamese voice found on this device. Pronunciation may use a default voice.
            For best results on iPad, go to <strong>Settings → Accessibility → Spoken Content → Voices → Vietnamese</strong>.
          </span>
          <button
            onClick={dismissBanner}
            className="text-amber-500 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-200 ml-2 leading-none text-lg"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Flashcard — tap to toggle translation */}
      <div
        onClick={() => setFlipped(f => !f)}
        className="relative w-full rounded-2xl border-2 flex flex-col items-start p-8 transition-colors bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 active:bg-gray-50 dark:active:bg-gray-800 cursor-pointer"
        style={{ minHeight: '14rem' }}
      >
        <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4 w-full text-center">
          {card.vietnamese}
        </div>

        {flipped ? (
          <>
            <div className="text-lg text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700 pt-4 w-full text-center">
              {card.english}
            </div>
            {card.breakdown && (
              <div className="w-full" onClick={e => e.stopPropagation()}>
                <BreakdownDisplay
                  breakdown={card.breakdown}
                  speakingKey={speakingKey}
                  onSpeakChunk={(i, text) => handleSpeak(`chunk-${i}`, text)}
                  onSpeakFull={() => handleSpeak('full', card.vietnamese, 1)}
                />
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-gray-400 dark:text-gray-600 w-full text-center">
            tap to reveal
          </div>
        )}

        {/* Speaker button — speaks full phrase at learning rate */}
        <button
          onClick={e => { e.stopPropagation(); handleSpeak('card', card.vietnamese) }}
          className="absolute bottom-4 right-4 w-11 h-11 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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
          className="w-14 h-14 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-30 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-900 dark:hover:text-gray-200 active:bg-gray-50 dark:active:bg-gray-800 transition-colors text-2xl"
          aria-label="Previous card"
        >
          ‹
        </button>
        <button
          onClick={() => goTo(index + 1)}
          disabled={index === cards.length - 1}
          className="w-14 h-14 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-30 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-900 dark:hover:text-gray-200 active:bg-gray-50 dark:active:bg-gray-800 transition-colors text-2xl"
          aria-label="Next card"
        >
          ›
        </button>
      </div>
    </div>
  )
}
