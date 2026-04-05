import { useState, useRef, useEffect } from 'react'

function getMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4']
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type
  }
  return 'audio/webm'
}

async function blobToBase64(blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const uint8 = new Uint8Array(arrayBuffer)
  let binary = ''
  for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i])
  return btoa(binary)
}

function ScoreBadge({ score }) {
  let cls
  if (score >= 70) cls = 'bg-green-50 dark:bg-green-900/20 border border-co-fern text-co-fern'
  else if (score >= 40) cls = 'bg-co-cream dark:bg-yellow-900/20 border border-co-gold text-amber-700 dark:text-amber-400'
  else cls = 'bg-red-50 dark:bg-red-900/20 border border-red-300 text-red-600 dark:text-red-400'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold ${cls}`}>
      {score}
    </span>
  )
}

function AssessmentDot({ assessment }) {
  if (assessment === 'correct') return <span className="text-co-fern text-xs font-semibold">✓</span>
  if (assessment === 'off') return <span className="text-red-500 text-xs font-semibold">✗</span>
  return <span className="text-co-muted dark:text-gray-400 text-xs font-semibold">?</span>
}

const MATCH_LABELS = { exact: 'Exact match', close: 'Close', partial: 'Partial', miss: 'Missed' }

export default function PronunciationQuiz({ cards, onDone }) {
  const [phase, setPhase] = useState('word-ready')
  const [wordIndex, setWordIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [wordResults, setWordResults] = useState([])
  const [currentAnalysis, setCurrentAnalysis] = useState(null)
  const [error, setError] = useState(null)
  const [modelLoading, setModelLoading] = useState(false)

  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const autoStopRef = useRef(null)
  const elapsedTimerRef = useRef(null)
  const streamRef = useRef(null)
  // Capture card at recording start so onstop closure stays in sync
  const recordingCardRef = useRef(null)

  const card = cards[wordIndex]

  useEffect(() => {
    return () => {
      clearTimeout(autoStopRef.current)
      clearInterval(elapsedTimerRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  async function startRecording() {
    setError(null)
    setModelLoading(false)

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('Microphone access denied. Please allow microphone access and try again.')
      return
    }
    streamRef.current = stream
    recordingCardRef.current = card

    const mimeType = getMimeType()
    const recorder = new MediaRecorder(stream, { mimeType })
    recorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      clearInterval(elapsedTimerRef.current)
      stream.getTracks().forEach(t => t.stop())
      streamRef.current = null
      const blob = new Blob(chunksRef.current, { type: mimeType })
      processAudio(blob, mimeType, recordingCardRef.current)
    }

    recorder.start(100)
    setElapsed(0)
    setPhase('recording')

    elapsedTimerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)

    autoStopRef.current = setTimeout(() => {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    }, 4000)
  }

  function stopRecording() {
    clearTimeout(autoStopRef.current)
    clearInterval(elapsedTimerRef.current)
    if (recorderRef.current?.state === 'recording') {
      setPhase('processing')
      recorderRef.current.stop()
    }
  }

  async function processAudio(blob, mimeType, targetCard) {
    setPhase('processing')
    setError(null)

    // Step 1: transcribe
    let transcript
    try {
      const base64 = await blobToBase64(blob)
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64, mimeType }),
      })
      const data = await res.json()

      if (data.error === 'model_loading') {
        setModelLoading(true)
        setPhase('word-ready')
        return
      }
      if (data.error === 'timeout') {
        setError('Recording was too long — try speaking for 3–4 seconds.')
        setPhase('word-ready')
        return
      }
      if (!res.ok || data.error) throw new Error(data.detail || data.error || 'Transcription failed')
      transcript = data.text ?? ''
    } catch {
      setError('Transcription failed. Please try again.')
      setPhase('word-ready')
      return
    }

    // Step 2: Claude analysis
    const toneContext = targetCard.breakdown?.length
      ? targetCard.breakdown.map(b => `${b.vi} (${b.en})`).join(' | ')
      : 'N/A'

    const systemPrompt = `You are a Vietnamese pronunciation coach. A learner was asked to say: "${targetCard.vietnamese}" (meaning: "${targetCard.english}").
The speech recognition heard: "${transcript}"
Tone context: ${toneContext}

Respond ONLY with JSON (no markdown):
{
  "score": <0-100>,
  "match": <"exact"|"close"|"partial"|"miss">,
  "heard_display": "<what was heard>",
  "syllable_feedback": [
    { "syllable": "<syllable>", "expected_tone": "<tone name>", "assessment": "<correct|off|unclear>", "tip": "<short tip>" }
  ],
  "overall_tip": "<one encouraging sentence>",
  "try_again": <true|false>
}`

    let analysis
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Analyze this pronunciation attempt.' }],
          system: systemPrompt,
          max_tokens: 512,
        }),
      })
      const data = await res.json()
      const rawText = data.content?.[0]?.text ?? ''
      analysis = JSON.parse(rawText)
    } catch {
      setError('Analysis failed. Please try again.')
      setPhase('word-ready')
      return
    }

    setCurrentAnalysis(analysis)
    setPhase('feedback')
  }

  function advanceWord(analysis) {
    const result = { card, analysis, skipped: analysis === null }
    const newResults = [...wordResults, result]
    setWordResults(newResults)
    setCurrentAnalysis(null)
    setError(null)
    setModelLoading(false)

    if (wordIndex + 1 >= cards.length) {
      setWordResults(newResults)
      setPhase('done')
    } else {
      setWordIndex(wordIndex + 1)
      setPhase('word-ready')
    }
  }

  function handleFinish() {
    const resultsMap = new Map()
    let correctCount = 0
    for (const { card: c, analysis, skipped } of wordResults) {
      const passed = !skipped && analysis != null && analysis.score >= 60
      resultsMap.set(c.id, passed)
      if (passed) correctCount++
    }
    onDone({ score: correctCount, total: cards.length, results: resultsMap })
  }

  const progressPct = phase === 'done' ? 100 : Math.round((wordIndex / cards.length) * 100)

  // ─── Progress bar (shared) ──────────────────────────────────────────────────
  const progressBar = (
    <div className="mb-6">
      <div className="h-1.5 rounded-full bg-co-border dark:bg-gray-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-co-primary transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      {phase !== 'done' && (
        <div className="flex justify-between text-xs text-co-muted dark:text-gray-400 mt-1">
          <span>Word {wordIndex + 1} of {cards.length}</span>
          <span>{progressPct}%</span>
        </div>
      )}
    </div>
  )

  // ─── Done / summary phase ───────────────────────────────────────────────────
  if (phase === 'done') {
    const passCount = wordResults.filter(r => !r.skipped && r.analysis?.score >= 60).length
    return (
      <div className="page-fade-in space-y-4">
        {progressBar}
        <div className="text-center mb-2">
          <div className="font-display text-4xl font-bold text-co-primary mb-1">
            {Math.round((passCount / cards.length) * 100)}%
          </div>
          <div className="text-co-muted dark:text-gray-400 text-sm">{passCount} / {cards.length} passed</div>
        </div>

        <div className="space-y-2">
          {wordResults.map(({ card: c, analysis, skipped }, i) => (
            <div
              key={c.id}
              className="bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-700 rounded-2xl p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div lang="vi" className="font-display font-semibold text-co-ink dark:text-gray-100 truncate">
                    {c.vietnamese}
                  </div>
                  <div className="text-xs text-co-muted dark:text-gray-400">{c.english}</div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {skipped || !analysis ? (
                    <span className="text-xs text-co-muted dark:text-gray-400 italic">Skipped</span>
                  ) : (
                    <>
                      <ScoreBadge score={analysis.score} />
                      <span className="text-xs text-co-muted dark:text-gray-400">
                        {MATCH_LABELS[analysis.match] ?? analysis.match}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {analysis?.overall_tip && (
                <div className="text-xs text-co-muted dark:text-gray-400 mt-2 border-t border-co-border dark:border-gray-700 pt-2">
                  {analysis.overall_tip}
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={handleFinish}
          className="w-full bg-co-primary text-white py-3 rounded-2xl font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 cursor-pointer mt-2"
        >
          Finish
        </button>
      </div>
    )
  }

  // ─── Feedback phase ─────────────────────────────────────────────────────────
  if (phase === 'feedback' && currentAnalysis) {
    const a = currentAnalysis
    return (
      <div className="page-fade-in space-y-4">
        {progressBar}

        {/* Score header */}
        <div className="bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div lang="vi" className="font-display text-xl font-bold text-co-ink dark:text-gray-100">{card.vietnamese}</div>
              <div className="text-sm text-co-muted dark:text-gray-400">{card.english}</div>
            </div>
            <ScoreBadge score={a.score} />
          </div>
          <div className="text-sm text-co-muted dark:text-gray-400">
            <span className="font-medium text-co-ink dark:text-gray-200">Heard: </span>
            {a.heard_display || '(nothing recognised)'}
          </div>
          {a.match && (
            <div className="mt-1 text-xs text-co-muted dark:text-gray-400">
              {MATCH_LABELS[a.match] ?? a.match}
            </div>
          )}
        </div>

        {/* Syllable feedback */}
        {a.syllable_feedback?.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-co-muted dark:text-gray-400 uppercase tracking-widest">
              Syllable breakdown
            </div>
            {a.syllable_feedback.map((sf, i) => (
              <div
                key={i}
                className="bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-700 rounded-xl p-3 flex items-start gap-3"
              >
                <AssessmentDot assessment={sf.assessment} />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span lang="vi" className="font-display font-semibold text-co-ink dark:text-gray-100">{sf.syllable}</span>
                    <span className="text-xs text-co-muted dark:text-gray-400">{sf.expected_tone}</span>
                  </div>
                  {sf.tip && <div className="text-xs text-co-muted dark:text-gray-400 mt-0.5">{sf.tip}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Overall tip */}
        {a.overall_tip && (
          <div className="text-sm text-co-muted dark:text-gray-400 italic text-center px-2">
            {a.overall_tip}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          {a.try_again && (
            <button
              onClick={() => { setCurrentAnalysis(null); setPhase('word-ready') }}
              className="flex-1 bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-700 text-co-ink dark:text-gray-100 py-3 rounded-2xl font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 cursor-pointer"
            >
              Try Again
            </button>
          )}
          <button
            onClick={() => advanceWord(currentAnalysis)}
            className="flex-1 bg-co-primary text-white py-3 rounded-2xl font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 cursor-pointer"
          >
            {wordIndex + 1 >= cards.length ? 'See Results' : 'Next Word'}
          </button>
        </div>
      </div>
    )
  }

  // ─── Processing phase ───────────────────────────────────────────────────────
  if (phase === 'processing') {
    return (
      <div className="page-fade-in space-y-4">
        {progressBar}
        <div className="bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-700 rounded-2xl p-8 flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-co-border dark:border-gray-600 border-t-co-primary animate-spin" />
          <div className="text-sm text-co-muted dark:text-gray-400">Analysing your pronunciation…</div>
        </div>
      </div>
    )
  }

  // ─── Recording phase ────────────────────────────────────────────────────────
  if (phase === 'recording') {
    const elapsedPct = Math.min((elapsed / 8) * 100, 100)
    return (
      <div className="page-fade-in space-y-4">
        {progressBar}

        <div className="bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-700 rounded-2xl p-6 text-center">
          <div className="text-xs text-co-muted dark:text-gray-400 uppercase tracking-widest mb-2">Say this word</div>
          <div lang="vi" className="font-display text-3xl font-bold text-co-ink dark:text-gray-100 mb-1">{card.vietnamese}</div>
          <div className="text-co-muted dark:text-gray-400 text-sm">{card.english}</div>
        </div>

        {/* Recording timer bar */}
        <div>
          <div className="h-1.5 rounded-full bg-co-border dark:bg-gray-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${elapsed >= 6 ? 'bg-red-500' : 'bg-co-primary'}`}
              style={{ width: `${elapsedPct}%` }}
            />
          </div>
          <div className="text-xs text-co-muted dark:text-gray-400 text-right mt-1">{elapsed}s / 4s</div>
        </div>

        {/* Pulsing record indicator */}
        <div className="flex justify-center">
          <div className="relative flex items-center justify-center">
            <span className="absolute inline-flex h-14 w-14 rounded-full bg-red-400 opacity-40 animate-ping" aria-hidden="true" />
            <button
              onClick={stopRecording}
              className="relative w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 cursor-pointer"
              aria-label="Stop recording"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          </div>
        </div>
        <div className="text-center text-xs text-co-muted dark:text-gray-400">Tap to stop recording</div>
      </div>
    )
  }

  // ─── Word-ready phase (default) ─────────────────────────────────────────────
  return (
    <div className="page-fade-in space-y-4">
      {progressBar}

      <div className="bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-700 rounded-2xl p-6 text-center">
        <div className="text-xs text-co-muted dark:text-gray-400 uppercase tracking-widest mb-3">Pronounce this word</div>
        <div lang="vi" className="font-display text-3xl font-bold text-co-ink dark:text-gray-100 mb-1">{card.vietnamese}</div>
        <div className="text-co-muted dark:text-gray-400 text-sm">{card.english}</div>
      </div>

      {/* Model loading notice */}
      {modelLoading && (
        <div className="bg-amber-50 dark:bg-yellow-900/20 border border-co-gold rounded-2xl p-4 text-sm text-amber-700 dark:text-amber-400 text-center">
          PhoWhisper is warming up — please try again in ~20 seconds.
        </div>
      )}

      {/* Error notice */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 rounded-2xl p-4 text-sm text-red-600 dark:text-red-400 text-center">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => advanceWord(null)}
          className="flex-1 bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-700 text-co-ink dark:text-gray-100 py-3 rounded-2xl font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 cursor-pointer"
        >
          Skip
        </button>
        <button
          onClick={startRecording}
          className="flex-2 flex-1 bg-co-primary text-white py-3 rounded-2xl font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2 cursor-pointer flex items-center justify-center gap-2"
          aria-label={`Record pronunciation of ${card.vietnamese}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
            <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
            <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
          </svg>
          Record
        </button>
      </div>
    </div>
  )
}
