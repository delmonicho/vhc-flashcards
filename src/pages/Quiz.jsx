import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { speakVietnamese, cancelSpeech } from '../lib/speak'
import { logError } from '../lib/logger'
import { useAuth } from '../context/AuthContext'
import {
  loadMastery, saveMastery, recordResult,
  addXP, loadXP, XP_RATES, selectQuizCards,
  getMasteryStage, syncMasteryToSupabase,
  loadMasteryFromSupabase, mergeMastery, getNextStageHints,
  updateStreak,
} from '../lib/mastery'
import MasteryBar from '../components/MasteryBar'
import BreakdownDisplay from '../components/BreakdownDisplay'
import MultipleChoice from '../components/quiz/MultipleChoice'
import QuickFire from '../components/quiz/QuickFire'
import PairMatch from '../components/quiz/PairMatch'
import TileAssembly from '../components/quiz/TileAssembly'
import PronunciationQuiz from '../components/quiz/PronunciationQuiz'

const ROUND_SIZES = { mc: 10, quickfire: 20, match: 6, tiles: 8, pronunciation: 5 }

const QUIZ_TYPES = [
  { id: 'mc',           title: 'Multiple Choice', description: 'Pick the correct English translation.',              minCards: 4, roundSize: ROUND_SIZES.mc },
  { id: 'quickfire',    title: 'Quick Fire',       description: 'Flip cards, mark what you know.',                  minCards: 1, roundSize: ROUND_SIZES.quickfire },
  { id: 'match',        title: 'Pair Match',       description: 'Match Vietnamese words to their English meanings.', minCards: 4, roundSize: ROUND_SIZES.match },
  { id: 'tiles',        title: 'Word Builder',     description: 'Arrange Vietnamese tiles to match the English. 60s timer — earn +5s per correct answer.', minCards: 2, roundSize: ROUND_SIZES.tiles },
  { id: 'pronunciation', title: 'Pronunciation',   description: 'Record yourself saying each word and get tone-by-tone feedback.', minCards: 1, roundSize: ROUND_SIZES.pronunciation, requiresMic: true },
]

const STAGE_NAMES = ['Unseen', 'Learning', 'Familiar', 'Confident', 'Mastered']

function SpeakerIcon({ active }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
      className={`w-4 h-4 shrink-0 ${active ? 'animate-pulse text-co-primary' : ''}`} aria-hidden="true">
      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.241 1.518 1.905 2.659 1.905H6.44l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
      <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
    </svg>
  )
}

export default function Quiz({ deckId, onNavigate, dark, onToggleDark }) {
  const { user } = useAuth()
  const [phase, setPhase] = useState('pick')
  const [quizType, setQuizType] = useState(null)
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState(null)
  const [masteryData, setMasteryData] = useState(() => loadMastery())
  const [expandedCardId, setExpandedCardId] = useState(null)
  const [speakingKey, setSpeakingKey] = useState(null)
  const [xpBarWidth, setXpBarWidth] = useState(0)

  // Animate XP bar when score screen appears
  useEffect(() => {
    if (phase !== 'score' || !result?.xpBarPct) return
    setXpBarWidth(0)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setXpBarWidth(result.xpBarPct)
      })
    })
  }, [phase, result?.xpBarPct])

  useEffect(() => {
    supabase
      .from('flashcards')
      .select('*')
      .eq('deck_id', deckId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) logError('Failed to load cards for quiz', { page: 'quiz', action: 'fetchData', err: error, details: { deckId } })
        setCards(data || [])
        setLoading(false)
      })
    // Merge Supabase mastery with localStorage so deck progress matches Profile
    if (user) {
      loadMasteryFromSupabase(user.id, supabase).then(remote => {
        const merged = mergeMastery(loadMastery(), remote)
        saveMastery(merged)
        setMasteryData(merged)
      })
    }
    return () => cancelSpeech()
  }, [deckId, user])

  function handleDone({ score, total, results, timeLeft }) {
    // Snapshot stages before update to compute improvements
    const beforeStages = {}
    for (const [cardId] of results) beforeStages[cardId] = getMasteryStage(masteryData[cardId])

    const updated = { ...masteryData }
    for (const [cardId, wasCorrect] of results) {
      recordResult(cardId, wasCorrect, updated)
    }
    saveMastery(updated)
    setMasteryData(updated)

    // Compute cards that moved up a stage
    const improved = []
    for (const [cardId] of results) {
      const after = getMasteryStage(updated[cardId])
      if (after > beforeStages[cardId]) {
        improved.push({ cardId, stageName: STAGE_NAMES[after] })
      }
    }

    // XP
    const baseXP = Math.round(score * XP_RATES[quizType])
    const timeBonus = timeLeft != null ? Math.floor(timeLeft / 10) : 0
    const xpEarned = baseXP + timeBonus
    const totalXP = addXP(xpEarned)

    // Bar fills to reflect this round's accuracy so 100% correct = full bar
    const xpBarPct = total > 0 ? Math.round((score / total) * 100) : 0

    // Cards that didn't level up but have a clear next-step hint
    const nearlyThere = []
    for (const [cardId] of results) {
      const currentStage = getMasteryStage(updated[cardId])
      if (currentStage === beforeStages[cardId]) {
        const hints = getNextStageHints(updated[cardId])
        if (hints.length > 0) {
          nearlyThere.push({ cardId, hints, targetStage: STAGE_NAMES[currentStage + 1] })
        }
      }
    }

    // Streak
    const streak = updateStreak()

    // Sync changed entries to Supabase (fire-and-forget)
    const changedIds = [...results.keys()]
    syncMasteryToSupabase(changedIds, user?.id, deckId, updated, supabase)

    setResult({ score, total, results, improved, xpEarned, totalXP, xpBarPct, nearlyThere, streak })
    setPhase('score')
  }

  function startQuiz(type) {
    setQuizType(type)
    setPhase('playing')
  }

  function handleSpeak(cardId, text) {
    setSpeakingKey(cardId)
    speakVietnamese(text)
      .catch(err => logError('Speech synthesis failed', { page: 'quiz', action: 'speak', err, details: { text } }))
      .finally(() => setSpeakingKey(null))
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
            onClick={() => onNavigate('deck', deckId)}
            className="w-11 h-11 flex items-center justify-center rounded-full text-co-muted dark:text-gray-400 hover:text-co-primary hover:bg-co-surface dark:hover:bg-gray-800 transition-all text-xl leading-none focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 cursor-pointer"
            aria-label="Back"
          >←</button>
          <h1 className="flex-1 font-display text-2xl font-bold text-co-ink dark:text-gray-100">Quiz</h1>
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
            if (qt.requiresMic && !navigator.mediaDevices?.getUserMedia) {
              eligible = false
              notEligibleReason = 'Microphone not available'
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
                {eligible ? (
                  <div className="text-xs text-co-muted dark:text-gray-500 mt-1">Up to {qt.roundSize} cards per round</div>
                ) : (
                  <div className="text-xs text-co-muted dark:text-gray-500 mt-1">{notEligibleReason}</div>
                )}
              </button>
            )
          })}
        </div>

        <button
          onClick={() => onNavigate('lotus-quest', deckId)}
          disabled={cards.length === 0}
          className="mt-4 w-full text-left bg-[#0d1018] dark:bg-[#0d1018] border-2 border-[#444] rounded-2xl p-5 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 disabled:opacity-40 hover:enabled:border-[#888] active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed"
          style={{ boxShadow: '2px 2px 0 #000' }}
        >
          <div className="font-mono font-semibold text-[#e0e0e0] text-lg">▶ QUEST</div>
          <div className="text-[#888] text-sm mt-0.5">16-bit vocabulary adventure mode.</div>
        </button>
      </div>
    )
  }

  // ─── Playing phase ────────────────────────────────────────────────────────
  if (phase === 'playing') {
    const quizCards = quizType === 'tiles'
      ? cards.filter(c => c.vietnamese.trim().split(/\s+/).length >= 2)
      : cards
    const sampledCards = selectQuizCards(quizCards, ROUND_SIZES[quizType], masteryData)
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
        </div>

        {quizType === 'mc'           && <MultipleChoice {...quizProps} allCards={cards} />}
        {quizType === 'quickfire'    && <QuickFire {...quizProps} />}
        {quizType === 'match'        && <PairMatch {...quizProps} />}
        {quizType === 'tiles'        && <TileAssembly {...quizProps} />}
        {quizType === 'pronunciation' && <PronunciationQuiz {...quizProps} />}
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
      </div>

      {/* Score */}
      <div className="text-center mb-8">
        <div className="font-display text-6xl font-bold text-co-primary mb-1">{scorePct}%</div>
        <div className="text-co-muted dark:text-gray-400 text-sm">{result.score} / {result.total} correct</div>
        {result.xpEarned > 0 && (
          <div className="mt-4 mx-auto max-w-xs">
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-co-gold">+{result.xpEarned} XP earned</span>
              <span className="text-co-muted dark:text-gray-400">{result.totalXP} XP all time</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-co-gold transition-all duration-700 ease-out"
                style={{ width: `${xpBarWidth}%` }}
              />
            </div>
            {result.streak?.current >= 2 && (
              <p className="text-sm text-co-muted dark:text-gray-400 mt-2">
                🔥 <span className="font-semibold text-co-ink dark:text-gray-100">{result.streak.current} day streak</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Mastery progress — hero section */}
      <div className="bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-700 rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-co-muted dark:text-gray-400 uppercase tracking-widest">
            Deck progress
          </span>
          {result.improved.length > 0 && (
            <span className="text-co-fern font-semibold text-sm">
              +{result.improved.length} word{result.improved.length !== 1 ? 's' : ''} improved
            </span>
          )}
        </div>
        <MasteryBar cards={cards} masteryData={masteryData} />
        {result.improved.length > 0 && (
          <ul className="mt-3 space-y-1">
            {result.improved.slice(0, 4).map(({ cardId, stageName }) => {
              const card = cards.find(c => c.id === cardId)
              if (!card) return null
              return (
                <li key={cardId} className="flex items-center gap-2 text-sm">
                  <span className="text-co-fern" aria-hidden="true">↑</span>
                  <span lang="vi" className="font-display font-medium text-co-ink dark:text-gray-100">{card.vietnamese}</span>
                  <span className="text-co-muted dark:text-gray-400">→ {stageName}</span>
                </li>
              )
            })}
            {result.improved.length > 4 && (
              <li className="text-xs text-co-muted dark:text-gray-400 pl-5">
                +{result.improved.length - 4} more
              </li>
            )}
          </ul>
        )}
        {result.nearlyThere?.length > 0 && (
          <>
            {result.improved.length > 0 && <div className="border-t border-co-border dark:border-gray-700 mt-3 mb-2" />}
            <div className="text-xs font-semibold text-co-muted dark:text-gray-400 uppercase tracking-widest mb-2">
              Close to leveling up
            </div>
            <ul className="space-y-1">
              {result.nearlyThere.slice(0, 3).map(({ cardId, hints, targetStage }) => {
                const card = cards.find(c => c.id === cardId)
                if (!card) return null
                const isDayGate = hints.some(h => h.includes('different day'))
                const hintText = isDayGate ? `ready tomorrow → ${targetStage}` : `${hints[0]} → ${targetStage}`
                return (
                  <li key={cardId} className="flex items-start gap-2 text-sm">
                    <span className="shrink-0 mt-0.5" aria-hidden="true">{isDayGate ? '📅' : '→'}</span>
                    <span>
                      <span lang="vi" className="font-display font-medium text-co-ink dark:text-gray-100">{card.vietnamese}</span>
                      <span className="text-co-muted dark:text-gray-400"> — {hintText}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
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
                onClick={() => card.breakdown && setExpandedCardId(expandedCardId === card.id ? null : card.id)}
                className={`bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-700 rounded-2xl p-4 ${card.breakdown ? 'cursor-pointer' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span lang="vi" className="font-display font-semibold text-co-ink dark:text-gray-100">
                    {card.vietnamese}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSpeak(card.id, card.vietnamese) }}
                      className="text-co-muted hover:text-co-ink dark:hover:text-gray-200 transition-colors cursor-pointer"
                      aria-label={`Pronounce ${card.vietnamese}`}
                    >
                      <SpeakerIcon active={speakingKey === card.id} />
                    </button>
                    {card.breakdown && (
                      <div
                        aria-hidden="true"
                        className="text-co-muted"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          className={`w-4 h-4 transition-transform ${expandedCardId === card.id ? 'rotate-180' : ''}`} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
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
          onClick={() => onNavigate('deck', deckId)}
          className="flex-1 bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-700 text-co-ink dark:text-gray-100 py-3 rounded-2xl font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 cursor-pointer"
        >
          Back to Deck
        </button>
      </div>
    </div>
  )
}
