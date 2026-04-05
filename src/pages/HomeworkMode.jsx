import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { translateToEnglish } from '../lib/translate'
import { normalizeVietnamese } from '../lib/breakdown'
import { logError } from '../lib/logger'
import { useAuth } from '../context/AuthContext'
import { speakVietnamese, cancelSpeech } from '../lib/speak'
import BreakdownDisplay from '../components/BreakdownDisplay'

// --- localStorage helpers ---
function loadSession(deckId) {
  try {
    const raw = localStorage.getItem(`homework-session-${deckId}`)
    return raw ? JSON.parse(raw) : { answers: [], cardCount: 0 }
  } catch {
    return { answers: [], cardCount: 0 }
  }
}

function saveSession(deckId, session) {
  try {
    localStorage.setItem(`homework-session-${deckId}`, JSON.stringify(session))
  } catch { /* quota exceeded — ignore */ }
}

// --- Clipboard formatter ---
function buildClipboardText(answers) {
  return answers.map(a => `${a.questionNum}. ${a.answer}`).join('\n')
}

// Fetch breakdown for display only (no flashcard update).
// Checks cache first; generates + caches if miss.
async function fetchBreakdownForDisplay(vi, en) {
  const viKey = normalizeVietnamese(vi)
  const { data } = await supabase
    .from('breakdowns')
    .select('breakdown')
    .eq('vi_key', viKey)
    .maybeSingle()
  if (data?.breakdown) return data.breakdown

  const { data: fnData, error } = await supabase.functions.invoke('generate-breakdown', {
    body: { vietnamese: vi, ...(en && { english: en }) },
  })
  if (error || !Array.isArray(fnData?.breakdown)) return null

  // Cache it so the later flashcard save finds it instantly
  await supabase
    .from('breakdowns')
    .upsert({ vi_key: viKey, breakdown: fnData.breakdown }, { onConflict: 'vi_key' })
    .catch(() => {})
  return fnData.breakdown
}

// --- VocabPanel ---
function VocabPanel({ deckId, userId, onCardAdded, onAddToSubmission }) {
  // Input
  const [viText, setViText] = useState('')
  const [enText, setEnText] = useState('')
  const [translateState, setTranslateState] = useState('idle') // 'idle'|'loading'|'translated'|'error'
  const [translateError, setTranslateError] = useState('')

  // Card (visible after translation, stays until Next)
  const [savedToDeck, setSavedToDeck] = useState(false)
  const [savingToDeck, setSavingToDeck] = useState(false)
  const [breakdown, setBreakdown] = useState(null) // null | 'loading' | [{vi,en}]
  const [speakingKey, setSpeakingKey] = useState(null)

  // Inline submission form
  const [subOpen, setSubOpen] = useState(false)
  const [subNum, setSubNum] = useState('')
  const [subAnswer, setSubAnswer] = useState('')
  const subNumRef = useRef(null)
  const subAnswerRef = useRef(null)

  const viInputRef = useRef(null)
  const enInputRef = useRef(null)

  // When submission form opens, focus the Q# field
  useEffect(() => {
    if (subOpen) setTimeout(() => subNumRef.current?.focus(), 0)
  }, [subOpen])

  async function handleTranslate() {
    if (translateState === 'loading' || !viText.trim()) return
    setTranslateState('loading')
    setTranslateError('')
    setSavedToDeck(false)
    setBreakdown(null)
    setSubOpen(false)
    try {
      const result = await translateToEnglish(viText.trim())
      setEnText(result)
      setTranslateState('translated')
      setTimeout(() => enInputRef.current?.focus(), 0)

      // Fetch breakdown in background
      setBreakdown('loading')
      fetchBreakdownForDisplay(viText.trim(), result)
        .then(bd => setBreakdown(bd || null))
        .catch(() => setBreakdown(null))
    } catch (err) {
      logError('Translation failed in homework mode', { page: 'homework', action: 'translate', err })
      setTranslateError('Translation failed. Try again.')
      setTranslateState('error')
    }
  }

  async function handleSaveToDeck() {
    if (savingToDeck || savedToDeck) return
    const vi = viText.trim()
    const en = enText.trim()
    if (!vi || !en) return
    setSavingToDeck(true)
    try {
      const { data, error: insertError } = await supabase
        .from('flashcards')
        .insert({ deck_id: deckId, user_id: userId, vietnamese: vi, english: en, source: ['homework'], status: 'new', breakdown: null })
        .select()
        .single()
      if (insertError) throw insertError
      setSavedToDeck(true)
      onCardAdded()
      // Breakdown is already in cache from fetchBreakdownForDisplay — this will find it instantly
      if (Array.isArray(breakdown)) {
        supabase.from('flashcards').update({ breakdown }).eq('id', data.id).catch(() => {})
      } else {
        import('../lib/breakdown').then(({ getOrCreateBreakdown }) => {
          getOrCreateBreakdown(vi, data.id, en)
            .catch(err => logError('Breakdown failed in homework mode', { page: 'homework', action: 'breakdown', err }))
        })
      }
    } catch (err) {
      logError('Card save failed in homework mode', { page: 'homework', action: 'save-card', err })
    } finally {
      setSavingToDeck(false)
    }
  }

  function handleNext() {
    cancelSpeech()
    setViText('')
    setEnText('')
    setTranslateState('idle')
    setTranslateError('')
    setSavedToDeck(false)
    setBreakdown(null)
    setSpeakingKey(null)
    setSubOpen(false)
    setSubNum('')
    setSubAnswer('')
    viInputRef.current?.focus()
  }

  function handleSpeak(text, key) {
    setSpeakingKey(key)
    speakVietnamese(text)
      .then(() => setSpeakingKey(null))
      .catch(() => setSpeakingKey(null))
  }

  function handleAddToSubmission() {
    const num = subNum.trim()
    const ans = subAnswer.trim()
    if (!num || !ans) return
    onAddToSubmission({ id: crypto.randomUUID(), questionNum: num, answer: ans })
    setSubOpen(false)
    setSubNum('')
    setSubAnswer('')
  }

  const isTranslated = translateState === 'translated'

  return (
    <div className="bg-co-surface dark:bg-gray-800/50 rounded-2xl p-5 border border-co-border dark:border-gray-700">
      <h2 className="font-display font-bold text-lg text-co-ink dark:text-gray-100 mb-4">
        Vocab &amp; Translation
      </h2>

      {/* Vietnamese input row */}
      <div className="flex gap-2 mb-3">
        <input
          ref={viInputRef}
          type="text"
          value={viText}
          onChange={e => {
            setViText(e.target.value)
            if (translateState !== 'idle') {
              setTranslateState('idle')
              setEnText('')
              setSavedToDeck(false)
              setBreakdown(null)
              setSubOpen(false)
            }
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); handleTranslate() }
          }}
          lang="vi"
          spellCheck={false}
          autoComplete="off"
          placeholder="Type Vietnamese phrase…"
          className="flex-1 border border-co-border dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-co-ink dark:text-gray-100 placeholder-co-muted dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-co-primary"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        />
        <button
          onClick={handleTranslate}
          disabled={!viText.trim() || translateState === 'loading'}
          className="px-4 py-2.5 bg-co-primary text-white rounded-xl font-semibold text-sm disabled:opacity-40 enabled:hover:scale-105 enabled:active:scale-95 transition-all duration-150 cursor-pointer disabled:cursor-default focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2"
        >
          {translateState === 'loading' ? 'Translating…' : 'Translate'}
        </button>
      </div>

      {/* Translation error */}
      {translateState === 'error' && (
        <div className="flex items-center gap-3 mb-3">
          <p className="text-sm text-red-500 dark:text-red-400 flex-1">{translateError}</p>
          <button onClick={handleTranslate} className="text-sm text-co-primary hover:underline cursor-pointer">Retry</button>
        </div>
      )}

      {/* Card — persists after translation until Next */}
      {isTranslated && (
        <div className="mt-2 rounded-xl border border-co-border dark:border-gray-600 bg-white dark:bg-gray-900 p-4">
          {/* Vietnamese + speech */}
          <div className="flex items-start gap-2 mb-2">
            <p className="flex-1 font-display font-semibold text-base text-co-ink dark:text-gray-100 leading-snug">
              {viText}
            </p>
            <button
              onClick={() => handleSpeak(viText, 'full')}
              aria-label="Pronounce Vietnamese"
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-co-muted dark:text-gray-400 hover:text-co-primary hover:bg-co-primary/10 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-co-primary"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                className={`w-4 h-4 ${speakingKey === 'full' ? 'animate-pulse text-co-primary' : ''}`} aria-hidden="true">
                <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.241 1.518 1.905 2.659 1.905H6.44l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
                <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
              </svg>
            </button>
          </div>

          {/* English — editable */}
          <input
            ref={enInputRef}
            type="text"
            value={enText}
            onChange={e => setEnText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveToDeck() } }}
            placeholder="English translation…"
            className="w-full border border-co-border dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-co-surface dark:bg-gray-800 text-co-ink dark:text-gray-100 placeholder-co-muted dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-co-primary mb-1"
          />

          {/* Breakdown */}
          {breakdown === 'loading' && (
            <p className="text-xs text-co-muted dark:text-gray-500 mt-3 flex items-center gap-1.5">
              <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
              <span className="ml-1">Generating breakdown…</span>
            </p>
          )}
          {Array.isArray(breakdown) && (
            <BreakdownDisplay
              breakdown={breakdown}
              speakingKey={speakingKey}
              onSpeakChunk={(i, text) => handleSpeak(text, `chunk-${i}`)}
              onSpeakFull={() => handleSpeak(viText, 'full')}
            />
          )}

          {/* Card actions */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-co-border dark:border-gray-700 flex-wrap">
            {/* Save to deck */}
            <button
              onClick={handleSaveToDeck}
              disabled={savingToDeck || savedToDeck || !enText.trim()}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer disabled:cursor-default focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                savedToDeck
                  ? 'bg-co-fern/15 text-co-fern border border-co-fern/30 focus:ring-co-fern'
                  : 'bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-600 text-co-ink dark:text-gray-200 enabled:hover:border-co-primary focus:ring-co-primary disabled:opacity-50'
              }`}
            >
              {savedToDeck ? '✓ Saved to deck' : savingToDeck ? 'Saving…' : '+ Add to deck'}
            </button>

            {/* Add to submission */}
            <button
              onClick={() => setSubOpen(o => !o)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 ${
                subOpen
                  ? 'bg-co-gold/20 text-co-ink dark:text-gray-100 border border-co-gold/40'
                  : 'bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-600 text-co-ink dark:text-gray-200 hover:border-co-primary'
              }`}
            >
              📋 Add to submission
            </button>

            {/* Next phrase */}
            <button
              onClick={handleNext}
              className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-co-muted dark:text-gray-400 hover:text-co-ink dark:hover:text-gray-100 hover:bg-co-surface dark:hover:bg-gray-800 border border-transparent hover:border-co-border dark:hover:border-gray-600 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2"
            >
              Next →
            </button>
          </div>

          {/* Inline submission form */}
          {subOpen && (
            <div className="mt-3 pt-3 border-t border-co-border dark:border-gray-700">
              <p className="text-xs text-co-muted dark:text-gray-400 mb-2 font-semibold uppercase tracking-wide">Add to submission</p>
              <div className="flex gap-2 items-center">
                <input
                  ref={subNumRef}
                  type="text"
                  value={subNum}
                  onChange={e => setSubNum(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); subAnswerRef.current?.focus() } }}
                  placeholder="Q#"
                  aria-label="Question number"
                  className="w-14 border border-co-border dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-co-ink dark:text-gray-100 placeholder-co-muted dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-co-primary text-center"
                />
                <input
                  ref={subAnswerRef}
                  type="text"
                  value={subAnswer}
                  onChange={e => setSubAnswer(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddToSubmission() } }}
                  placeholder="Answer (a / b / c / d)"
                  aria-label="Answer"
                  className="flex-1 border border-co-border dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-co-ink dark:text-gray-100 placeholder-co-muted dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-co-primary"
                />
                <button
                  onClick={handleAddToSubmission}
                  disabled={!subNum.trim() || !subAnswer.trim()}
                  className="px-3 py-1.5 bg-co-primary text-white rounded-lg font-semibold text-sm disabled:opacity-40 enabled:hover:scale-105 enabled:active:scale-95 transition-all cursor-pointer disabled:cursor-default focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2"
                >
                  Add ✓
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- SubmissionPanel ---
function SubmissionPanel({ answers, cardCount, onAdd, onDelete, onClear }) {
  const [numInput, setNumInput] = useState('')
  const [answerInput, setAnswerInput] = useState('')
  const [copyState, setCopyState] = useState('idle') // 'idle'|'copied'|'error'
  const answerInputRef = useRef(null)

  function handleAddAnswer() {
    const num = numInput.trim()
    const ans = answerInput.trim()
    if (!num || !ans) return
    onAdd({ id: crypto.randomUUID(), questionNum: num, answer: ans })
    setAnswerInput('')
    const n = parseInt(num, 10)
    setNumInput(!isNaN(n) ? String(n + 1) : '')
    answerInputRef.current?.focus()
  }

  async function handleCopy() {
    if (answers.length === 0) return
    try {
      await navigator.clipboard.writeText(buildClipboardText(answers))
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      setCopyState('error')
      setTimeout(() => setCopyState('idle'), 2000)
    }
  }

  return (
    <div className="bg-co-surface dark:bg-gray-800/50 rounded-2xl p-5 border border-co-border dark:border-gray-700 md:sticky md:top-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg text-co-ink dark:text-gray-100">
          Submission
          {answers.length > 0 && (
            <span className="ml-2 text-sm font-normal text-co-muted dark:text-gray-400">({answers.length})</span>
          )}
        </h2>
        {answers.length > 0 && (
          <button
            onClick={handleCopy}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 ${
              copyState === 'copied'
                ? 'bg-co-fern text-white'
                : copyState === 'error'
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                : 'bg-co-primary/10 text-co-primary hover:bg-co-primary/20'
            }`}
          >
            {copyState === 'copied' ? 'Copied!' : copyState === 'error' ? 'Failed' : 'Copy'}
          </button>
        )}
      </div>

      {/* Add answer row */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={numInput}
          onChange={e => setNumInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); answerInputRef.current?.focus() } }}
          placeholder="Q#"
          aria-label="Question number"
          className="w-14 border border-co-border dark:border-gray-600 rounded-xl px-2 py-2 text-sm bg-white dark:bg-gray-900 text-co-ink dark:text-gray-100 placeholder-co-muted dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-co-primary text-center"
        />
        <input
          ref={answerInputRef}
          type="text"
          value={answerInput}
          onChange={e => setAnswerInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddAnswer() } }}
          placeholder="a / b / c / d"
          aria-label="Answer"
          className="flex-1 border border-co-border dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-900 text-co-ink dark:text-gray-100 placeholder-co-muted dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-co-primary"
        />
        <button
          onClick={handleAddAnswer}
          disabled={!numInput.trim() || !answerInput.trim()}
          className="px-4 py-2 bg-co-primary text-white rounded-xl font-semibold text-sm disabled:opacity-40 enabled:hover:scale-105 enabled:active:scale-95 transition-all cursor-pointer disabled:cursor-default focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2"
        >
          Add
        </button>
      </div>

      {/* Answer list */}
      {answers.length === 0 ? (
        <p className="text-sm text-co-muted dark:text-gray-500 text-center py-6">
          No answers recorded yet
        </p>
      ) : (
        <div className="space-y-1 mb-4" role="list">
          {answers.map(a => (
            <div
              key={a.id}
              role="listitem"
              className="group flex items-center gap-3 px-3 py-2 rounded-xl bg-white dark:bg-gray-900 border border-co-border dark:border-gray-700"
            >
              <span className="text-xs text-co-muted dark:text-gray-500 min-w-[28px] font-mono">{a.questionNum}.</span>
              <span className="flex-1 text-sm text-co-ink dark:text-gray-100 font-medium">{a.answer}</span>
              <button
                onClick={() => onDelete(a.id)}
                aria-label={`Delete answer ${a.questionNum}`}
                className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-full text-co-muted dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm leading-none"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-co-border dark:border-gray-700">
        <span className="text-xs text-co-muted dark:text-gray-500">
          {cardCount > 0 ? `${cardCount} card${cardCount !== 1 ? 's' : ''} added to deck` : 'No cards added yet'}
        </span>
        {(answers.length > 0 || cardCount > 0) && (
          <button
            onClick={onClear}
            className="text-xs text-co-muted dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
          >
            Clear session
          </button>
        )}
      </div>
    </div>
  )
}

// --- HomeworkMode (page) ---
export default function HomeworkMode({ deckId, onNavigate }) {
  const { user } = useAuth()
  const [deck, setDeck] = useState(null)
  const [session, setSession] = useState(() => loadSession(deckId))

  useEffect(() => {
    saveSession(deckId, session)
  }, [session, deckId])

  useEffect(() => {
    if (!deckId) { onNavigate('home'); return }
    supabase.from('decks').select('id, title').eq('id', deckId).single()
      .then(({ data, error }) => {
        if (error || !data) { onNavigate('home'); return }
        setDeck(data)
      })
  }, [deckId, onNavigate])

  function handleCardAdded() {
    setSession(s => ({ ...s, cardCount: s.cardCount + 1 }))
  }

  function handleAddAnswer(entry) {
    setSession(s => ({ ...s, answers: [...s.answers, entry] }))
  }

  function handleDeleteAnswer(id) {
    setSession(s => ({ ...s, answers: s.answers.filter(a => a.id !== id) }))
  }

  function handleClearSession() {
    setSession({ answers: [], cardCount: 0 })
  }

  return (
    <div className="page-fade-in max-w-5xl mx-auto px-4 py-6 md:px-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => onNavigate('deck', deckId)}
          className="flex items-center gap-1.5 text-sm text-co-muted dark:text-gray-400 hover:text-co-ink dark:hover:text-gray-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 rounded-lg px-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          Back
        </button>
        <h1 className="font-display text-xl font-bold text-co-ink dark:text-gray-100 truncate flex-1 min-w-0">
          {deck ? `Homework — ${deck.title}` : 'Homework'}
        </h1>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        <VocabPanel
          deckId={deckId}
          userId={user?.id}
          onCardAdded={handleCardAdded}
          onAddToSubmission={handleAddAnswer}
        />
        <SubmissionPanel
          answers={session.answers}
          cardCount={session.cardCount}
          onAdd={handleAddAnswer}
          onDelete={handleDeleteAnswer}
          onClear={handleClearSession}
        />
      </div>
    </div>
  )
}
