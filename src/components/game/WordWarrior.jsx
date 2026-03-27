import { useState, useEffect, useRef } from 'react'
import LotusSpirit from './sprites/LotusSpirit'
import { addXP, loadXP } from '../../lib/mastery'
import { playCorrect, playWrong, playVictory, playFlip } from '../../lib/sounds'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function WordWarrior({ flashcards, onComplete }) {
  const [queue, setQueue] = useState(() => shuffle(flashcards))
  const [lives, setLives] = useState(5)
  const [phase, setPhase] = useState('card') // 'card' | 'flipped' | 'result'
  const [defeated, setDefeated] = useState(0)
  const [sessionXP, setSessionXP] = useState(0)
  const [animClass, setAnimClass] = useState('')
  const [isDefeating, setIsDefeating] = useState(false)
  const [victory, setVictory] = useState(false)
  const results = useRef(new Map())
  const startXP = useRef(loadXP().xp)

  const currentCard = queue[0]

  useEffect(() => {
    if (queue.length === 0 && defeated > 0) {
      setVictory(true)
      setPhase('result')
    } else if (lives <= 0) {
      setVictory(false)
      setPhase('result')
    }
  }, [queue.length, lives, defeated])

  function handleFlip() {
    playFlip()
    setPhase('flipped')
  }

  function handleGotIt() {
    if (isDefeating) return
    playCorrect()
    results.current.set(currentCard.id, true)
    setAnimClass('enemy-defeat')
    setIsDefeating(true)
    setTimeout(() => {
      const newXP = addXP(2)
      setSessionXP(newXP - startXP.current)
      setDefeated(d => d + 1)
      setQueue(q => q.slice(1))
      setAnimClass('')
      setIsDefeating(false)
      setPhase('card')
    }, 400)
  }

  function handleReview() {
    playWrong()
    results.current.set(currentCard.id, false)
    setAnimClass('shield-block')
    setLives(l => l - 1)
    setQueue(q => [...q.slice(1), q[0]])
    setTimeout(() => {
      setAnimClass('')
      setPhase('card')
    }, 300)
  }

  function handleContinue() {
    if (victory) playVictory()
    onComplete(results.current)
  }

  if (phase === 'result') {
    const escaped = queue.length
    const totalXPNow = loadXP().xp
    const xpEarned = totalXPNow - startXP.current

    return (
      <div className="pixel-mode min-h-screen flex flex-col items-center justify-center px-4 py-8 gap-8">
        <div className="text-center">
          {victory ? (
            <>
              <div className="font-pixel-ui text-[#F5A623] text-lg mb-4 leading-relaxed">VICTORY!</div>
              <div className="flex justify-center gap-4 mb-6">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-2xl pixel-firework" style={{ animationDelay: `${i * 0.12}s` }}>✦</span>
                ))}
              </div>
            </>
          ) : (
            <div className="font-pixel-ui text-[#E8526A] text-lg mb-4 leading-relaxed">GAME OVER</div>
          )}
          <div className="font-pixel-ui pixel-border bg-[#1a2030] p-6 rounded flex flex-col gap-4 text-sm leading-loose">
            <div>⚔ DEFEATED: <span className="text-[#5BAF7A]">{defeated}</span></div>
            {escaped > 0 && <div>🛡 ESCAPED: <span className="text-[#E8526A]">{escaped}</span></div>}
            <div>✦ XP EARNED: <span className="text-[#F5A623]">+{xpEarned}</span></div>
          </div>
        </div>
        <button
          onClick={handleContinue}
          className="font-pixel-ui pixel-border bg-[#E8526A] text-white px-8 py-4 text-sm hover:bg-[#c43e56] active:scale-95 transition-transform"
        >
          CONTINUE
        </button>
      </div>
    )
  }

  return (
    <div className="pixel-mode min-h-screen flex flex-col px-4 py-6 gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 text-xl">
          {[...Array(5)].map((_, i) => (
            <span key={i}>{i < lives ? '❤' : '🖤'}</span>
          ))}
        </div>
        <div className="font-pixel-score text-[#F5A623] text-xs">{loadXP().xp} XP</div>
      </div>

      {/* Progress */}
      <div className="font-pixel-score text-center text-[10px] text-[#888]">
        {defeated} / {flashcards.length} DEFEATED
      </div>

      {/* Enemy area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <button
          onClick={phase === 'card' ? handleFlip : undefined}
          disabled={phase !== 'card'}
          className="flex flex-col items-center gap-4 cursor-pointer disabled:cursor-default focus:outline-none"
          aria-label="Tap to reveal"
        >
          <div className={animClass} onAnimationEnd={() => setAnimClass('')}>
            <LotusSpirit size={96} flashing={animClass === 'shield-block'} />
          </div>
          <div className="text-center leading-relaxed max-w-xs" style={{ fontFamily: 'var(--font-pixel-viet)', fontSize: 'clamp(20px,4vw,32px)' }}>
            {currentCard?.vietnamese}
          </div>
        </button>

        {phase === 'card' && (
          <div className="text-[10px] text-[#666] animate-pulse">TAP TO REVEAL</div>
        )}

        {phase === 'flipped' && (
          <div className="flex flex-col items-center gap-6 w-full max-w-xs">
            <div className="pixel-border bg-[#1a2030] px-6 py-4 text-center leading-relaxed text-[#e0e0e0] w-full" style={{ fontFamily: 'var(--font-pixel-viet)', fontSize: 'clamp(16px,3vw,24px)', opacity: 0.85 }}>
              {currentCard?.english}
            </div>
            <div className="flex gap-4 w-full">
              <button
                onClick={handleGotIt}
                disabled={isDefeating}
                className="font-pixel-ui flex-1 pixel-border-green bg-[#1a3024] text-[#5BAF7A] py-4 text-xs hover:bg-[#243d2e] active:scale-95 transition-transform disabled:opacity-50"
              >
                ⚔ GOT IT
              </button>
              <button
                onClick={handleReview}
                disabled={isDefeating}
                className="font-pixel-ui flex-1 pixel-border bg-[#1a2230] text-[#7aade8] py-4 text-xs hover:bg-[#1e2a3e] active:scale-95 transition-transform disabled:opacity-50"
                style={{ borderColor: '#1A5F8A', boxShadow: '3px 3px 0 #000' }}
              >
                🛡 REVIEW
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
