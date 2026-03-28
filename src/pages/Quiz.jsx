import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { speakVietnamese, cancelSpeech } from '../lib/speak'
import {
  loadMastery, saveMastery, recordResult,
  addXP, XP_RATES, weightedSample,
} from '../lib/mastery'
import BreakdownDisplay from '../components/BreakdownDisplay'
import MultipleChoice from '../components/quiz/MultipleChoice'
import QuickFire from '../components/quiz/QuickFire'
import PairMatch from '../components/quiz/PairMatch'
import TileAssembly from '../components/quiz/TileAssembly'
import ThemeToggle from '../components/ThemeToggle'

const QUIZ_TYPES = [
  { id: 'mc',        title: 'Multiple Choice', description: 'Pick the correct English translation.',              minCards: 4 },
  { id: 'quickfire', title: 'Quick Fire',       description: 'Flip cards, mark what you know.',                  minCards: 1 },
  { id: 'match',     title: 'Pair Match',       description: 'Match Vietnamese words to their English meanings.', minCards: 4 },
  { id: 'tiles',     title: 'Word Builder',     description: 'Arrange Vietnamese tiles to match the English. 60-second timer.', minCards: 2 },
]

function SpeakerIcon({ active }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
      className={`w-4 h-4 shrink-0 ${active ? 'animate-pulse text-co-primary' : ''}`} aria-hidden="true">
      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.241 1.518 1.905 2.659 1.905H6.44l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
      <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
    </svg>
  )
}

export default function Quiz({ weekId, onNavigate, dark, onToggleDark }) {
  const [phase, setPhase] = useState('pick')
  const [quizType, setQuizType] = useState(null)
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState(null)
  const [masteryData, setMasteryData] = useState(() => loadMastery())
  const [expandedCardId, setExpandedCardId] = useState(null)
  const [speakingKey, setSpeakingKey] = useState(null)
  const [xpBarWidth, setXpBarWidth] = useState(0)

  useEffect(() => {
    supabase
      .from('flashcards')
      .select('*')
      .eq('week_id', weekId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setCards(data || [])
        setLoading(false)
      })
    return () => cancelSpeech()
  }, [weekId])

  // Animate XP bar when score screen mounts
  useEffect(() => {
    if (phase === 'score' && result) {
      setXpBarWidth(0)
      const pct = Math.min((result.totalXP / 50) * 100, 100)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setXpBarWidth(pct))
      })
    }
  }, [phase, result])

  function handleDone({ score, total, results }) {
    const updated = { ...masteryData }
    for (const [cardId, wasCorrect] of results) {
      recordResult(cardId, wasCorrect, updated)
    }
    saveMastery(updated)
    setMasteryData(updated)
    const xpEarned = Math.round(score * XP_RATES[quizType])
    const totalXP = addXP(xpEarned)
    setResult({ score, total, results, xpEarned, totalXP })
    setPhase('score')
  }

  function startQuiz(type) {
    setQuizType(type)
    setPhase('playing')
  }

  function handleSpeak(cardId, text) {
    setSpeakingKey(cardId)
    speakVietnamese(text).finally(() => setSpeakingKey(null))
  }

  if (loading) {
    return (
      <div className="flex justify-center gap-2 py-16">
        <span className="loading-dot" />
        <span className="loading-dot" />
        <span className="loading-dot" />
      </div>
    )
  }

  // ─── Pick phase ───────────────────────────────────────────────────────────
  if (phase === 'pick') {
    return (
      <div className="page-fade-in max-w-2xl mx-auto px-4 py-6 md:px-8">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => onNavigate('week', weekId)}
            className="w-11 h-11 flex items-center justify-center rounded-full text-co-muted dark:text-gray-400 hover:text-co-primary hover:bg-co-surface dark:hover:bg-gray-800 transition-all text-xl leading-none focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 cursor-pointer"
            aria-label="Back"
          >←</button>
          <h1 className="flex-1 font-display text-2xl font-bold text-co-ink dark:text-gray-100">Quiz</h1>
          <ThemeToggle dark={dark} onToggle={onToggleDark} />
        </div>

        <div className="space-y-3">
          {QUIZ_TYPES.map(qt => {
            let eligible = cards.length >= qt.minCards
            let notEligibleReason = `Need ≥${qt.minCards} cards`
            if (qt.id === 'tiles') {
              const multiWord = cards.filter(c => c.vietnamese.trim().split(/\s+/).length >= 2)
              eligible = multiWord.length >= 2
              notEligibleReason = 'Need ≥2 multi-word cards'
            }
            return (
              <button
                key={qt.id}
                onClick={() => eligible && startQuiz(qt.id)}
                disabled={!eligible}
                className={`w-full text-left bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-700 rounded-2xl p-5 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 ${
                  eligible
                    ? 'hover:border-co-primary hover:shadow-md active:scale-[0.98] cursor-pointer'
                    : 'opacity-40 cursor-not-allowed'
                }`}
              >
                <div className="font-display font-semibold text-co-ink dark:text-gray-100 text-lg">{qt.title}</div>
                <div className="text-co-muted dark:text-gray-400 text-sm mt-0.5">{qt.description}</div>
                {!eligible && (
                  <div className="text-xs text-co-muted dark:text-gray-500 mt-1">{notEligibleReason}</div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── Playing phase ────────────────────────────────────────────────────────
  if (phase === 'playing') {
    const quizCards = quizType === 'tiles'
      ? cards.filter(c => c.vietnamese.trim().split(/\s+/).length >= 2)
      : cards
    const sampledCards = weightedSample(quizCards, quizCards.length, masteryData)
    const quizProps = { cards: sampledCards, onDone: handleDone }

    return (
      <div className="page-fade-in max-w-2xl mx-auto px-4 py-6 md:px-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setPhase('pick')}
            className="w-11 h-11 flex items-center justify-center rounded-full text-co-muted dark:text-gray-400 hover:text-co-primary hover:bg-co-surface dark:hover:bg-gray-800 transition-all text-xl leading-none focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 cursor-pointer"
            aria-label="Back"
          >←</button>
          <h2 className="flex-1 font-display text-xl font-bold text-co-ink dark:text-gray-100">
            {QUIZ_TYPES.find(q => q.id === quizType)?.title}
          </h2>
          <ThemeToggle dark={dark} onToggle={onToggleDark} />
        </div>

        {quizType === 'mc'        && <MultipleChoice {...quizProps} allCards={cards} />}
        {quizType === 'quickfire' && <QuickFire {...quizProps} />}
        {quizType === 'match'     && <PairMatch {...quizProps} />}
        {quizType === 'tiles'     && <TileAssembly {...quizProps} />}
      </div>
    )
  }

  // ─── Score phase ──────────────────────────────────────────────────────────
  const missedCards = cards.filter(c => result.results?.get(c.id) === false)
  const scorePct = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0

  return (
    <div className="page-fade-in max-w-2xl mx-auto px-4 py-6 md:px-8">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="flex-1 font-display text-2xl font-bold text-co-ink dark:text-gray-100">Results</h1>
        <ThemeToggle dark={dark} onToggle={onToggleDark} />
      </div>

      {/* Score */}
      <div className="text-center mb-8">
        <div className="font-display text-6xl font-bold text-co-primary mb-1">{scorePct}%</div>
        <div className="text-co-muted dark:text-gray-400 text-sm">{result.score} / {result.total} correct</div>
      </div>

      {/* XP bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-co-muted dark:text-gray-400 uppercase tracking-widest">Weekly XP</span>
          <span className="text-co-gold font-semibold text-sm">+{result.xpEarned} XP</span>
        </div>
        <div className="bg-co-border dark:bg-gray-700 h-2 rounded-full">
          <div
            className="bg-co-gold h-2 rounded-full transition-all duration-700"
            style={{ width: `${xpBarWidth}%` }}
          />
        </div>
        <div className="text-right text-xs text-co-muted dark:text-gray-500 mt-1">{result.totalXP} / 50 XP this week</div>
      </div>

      {/* Cards to Review */}
      {missedCards.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-co-muted dark:text-gray-400 uppercase tracking-widest mb-3">
            Cards to Review
          </h2>
          <div className="overflow-y-auto max-h-64 space-y-2">
            {missedCards.map(card => (
              <div
                key={card.id}
                className="bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-700 rounded-2xl p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span lang="vi" className="font-display font-semibold text-co-ink dark:text-gray-100">
                    {card.vietnamese}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleSpeak(card.id, card.vietnamese)}
                      className="text-co-muted hover:text-co-ink dark:hover:text-gray-200 transition-colors cursor-pointer"
                      aria-label={`Pronounce ${card.vietnamese}`}
                    >
                      <SpeakerIcon active={speakingKey === card.id} />
                    </button>
                    {card.breakdown && (
                      <button
                        onClick={() => setExpandedCardId(expandedCardId === card.id ? null : card.id)}
                        className="text-co-muted hover:text-co-ink dark:hover:text-gray-200 transition-colors cursor-pointer"
                        aria-expanded={expandedCardId === card.id}
                        aria-label="Toggle breakdown"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          className={`w-4 h-4 transition-transform ${expandedCardId === card.id ? 'rotate-180' : ''}`} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-co-muted dark:text-gray-400 text-sm mt-0.5">{card.english}</div>
                {expandedCardId === card.id && card.breakdown && (
                  <BreakdownDisplay breakdown={card.breakdown} speakingKey={null} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => { setPhase('pick'); setResult(null); setExpandedCardId(null) }}
          className="flex-1 bg-co-primary text-white py-3 rounded-2xl font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 cursor-pointer"
        >
          Play Again
        </button>
        <button
          onClick={() => onNavigate('week', weekId)}
          className="flex-1 bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-700 text-co-ink dark:text-gray-100 py-3 rounded-2xl font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 cursor-pointer"
        >
          Back to Week
        </button>
      </div>
    </div>
  )
}
