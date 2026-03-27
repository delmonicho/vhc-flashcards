import { useState, useEffect } from 'react'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function makeTiles(vietnamese) {
  return shuffle(vietnamese.trim().split(/\s+/).map((word, i) => ({ id: i, word })))
}

export default function TileAssembly({ cards, onDone }) {
  const [index, setIndex] = useState(0)
  const [bank, setBank] = useState(() => makeTiles(cards[0].vietnamese))
  const [answer, setAnswer] = useState([])
  const [secondsLeft, setSecondsLeft] = useState(60)
  const [attempts, setAttempts] = useState(0)
  const [shaking, setShaking] = useState(false)
  const [flashing, setFlashing] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  const [results] = useState(() => new Map())

  const card = cards[index]
  const correctWords = card.vietnamese.trim().split(/\s+/)

  // Reset tiles when card changes
  useEffect(() => {
    setBank(makeTiles(cards[index].vietnamese))
    setAnswer([])
    setAttempts(0)
    setShaking(false)
    setFlashing(false)
    setShowAnswer(false)
  }, [index])

  // Per-card countdown timer
  useEffect(() => {
    setSecondsLeft(60)
    const interval = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(interval)
          handleTimeUp()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [index])

  function handleTimeUp() {
    for (let i = index; i < cards.length; i++) {
      if (!results.has(cards[i].id)) results.set(cards[i].id, false)
    }
    const score = [...results.values()].filter(Boolean).length
    onDone({ score, total: cards.length, results })
  }

  function advance() {
    const next = index + 1
    if (next >= cards.length) {
      const score = [...results.values()].filter(Boolean).length
      onDone({ score, total: cards.length, results })
      return
    }
    setIndex(next)
  }

  function moveTileToAnswer(tile) {
    setBank(b => b.filter(t => t.id !== tile.id))
    setAnswer(a => [...a, tile])
  }

  function moveTileToBank(tile) {
    setAnswer(a => a.filter(t => t.id !== tile.id))
    setBank(b => [...b, tile])
  }

  function handleCheck() {
    const assembled = answer.map(t => t.word).join(' ')
    if (assembled === correctWords.join(' ')) {
      results.set(card.id, attempts === 0)
      setFlashing(true)
      setTimeout(() => {
        setFlashing(false)
        advance()
      }, 500)
    } else {
      const newAttempts = attempts + 1
      setAttempts(newAttempts)
      setShaking(true)
      setTimeout(() => {
        setShaking(false)
        setAnswer([])
        setBank(makeTiles(card.vietnamese))
        if (newAttempts >= 2) setShowAnswer(true)
      }, 350)
    }
  }

  function handleShowAnswer() {
    results.set(card.id, false)
    setAnswer(correctWords.map((word, i) => ({ id: i, word })))
    setBank([])
    setShowAnswer(false)
    setFlashing(true)
    setTimeout(() => {
      setFlashing(false)
      advance()
    }, 1000)
  }

  const canCheck = answer.length === correctWords.length && !flashing && !shaking

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-co-border dark:bg-gray-700 rounded-full h-1.5">
          <div
            className="bg-co-primary h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${(index / cards.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-co-muted dark:text-gray-400 tabular-nums">{index + 1} / {cards.length}</span>
      </div>

      {/* Timer bar */}
      <div className="bg-co-border dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
        <div
          key={index}
          className={`timer-bar h-1.5 rounded-full bg-co-primary${flashing ? ' paused' : ''}`}
        />
      </div>
      <div className="text-right text-xs text-co-muted dark:text-gray-500 -mt-2">{secondsLeft}s</div>

      {/* English prompt */}
      <div className="bg-co-surface dark:bg-gray-800 border border-co-border dark:border-gray-700 rounded-2xl p-5 text-center">
        <div className="text-xs font-semibold text-co-muted dark:text-gray-400 uppercase tracking-widest mb-2">English</div>
        <div className="font-display text-xl font-bold text-co-ink dark:text-gray-100">{card.english}</div>
      </div>

      {/* Answer area */}
      <div
        className={`min-h-14 border-2 rounded-2xl p-3 flex flex-wrap gap-2 transition-colors duration-200 ${
          flashing
            ? 'border-co-fern bg-green-50 dark:bg-green-900/20'
            : 'border-co-border dark:border-gray-600 bg-white dark:bg-gray-900'
        }`}
      >
        {answer.length === 0 && (
          <span className="text-co-muted dark:text-gray-500 text-sm self-center mx-auto">
            Tap tiles to build your answer
          </span>
        )}
        {answer.map(tile => (
          <button
            key={tile.id}
            onClick={() => !flashing && !shaking && moveTileToBank(tile)}
            lang="vi"
            className={`px-3 py-1.5 rounded-xl text-sm font-semibold bg-co-primary text-white transition-all active:scale-95 ${shaking ? 'shake' : ''} ${flashing ? 'tile-correct' : ''}`}
          >
            {tile.word}
          </button>
        ))}
      </div>

      {/* Show answer link */}
      {showAnswer && !flashing && (
        <div className="text-center">
          <button
            onClick={handleShowAnswer}
            className="text-sm text-co-muted dark:text-gray-400 hover:text-co-primary dark:hover:text-co-primary underline transition-colors"
          >
            Show answer
          </button>
        </div>
      )}

      {/* Tile bank */}
      <div className="flex flex-wrap gap-2 min-h-14 p-3 bg-co-surface dark:bg-gray-800 rounded-2xl border border-co-border dark:border-gray-700">
        {bank.map(tile => (
          <button
            key={tile.id}
            onClick={() => !flashing && !shaking && moveTileToAnswer(tile)}
            lang="vi"
            className="px-3 py-1.5 rounded-xl text-sm font-semibold bg-white dark:bg-gray-700 text-co-ink dark:text-gray-100 border border-co-border dark:border-gray-600 transition-all hover:border-co-primary hover:shadow-sm active:scale-95"
          >
            {tile.word}
          </button>
        ))}
      </div>

      {/* Check button */}
      {canCheck && (
        <button
          onClick={handleCheck}
          className="w-full bg-co-primary text-white py-3 rounded-2xl font-semibold text-sm hover:scale-[1.01] active:scale-[0.99] transition-all focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2"
        >
          Check
        </button>
      )}
    </div>
  )
}
