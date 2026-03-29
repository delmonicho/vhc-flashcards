import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { loadMastery, saveMastery, recordResult, loadXP, addXP } from '../lib/mastery'
import { logError } from '../lib/logger'
import { useAuth } from '../context/AuthContext'
import WordWarrior from '../components/game/WordWarrior'
import ChunkBuilder from '../components/game/ChunkBuilder'

export default function LotusQuest({ weekId, onNavigate }) {
  const { user } = useAuth()
  const [phase, setPhase] = useState('hub') // 'hub' | 'word-warrior' | 'chunk-builder' | 'score'
  const [cards, setCards] = useState([])
  const [week, setWeek] = useState(null)
  const [gameStats, setGameStats] = useState(null)
  const [masteryData, setMasteryData] = useState(() => loadMastery())
  const [loading, setLoading] = useState(true)

  // Chunk builder queue state
  const [cbQueue, setCbQueue] = useState([])
  const [cbIndex, setCbIndex] = useState(0)
  const [cbResults, setCbResults] = useState(new Map())

  // Score state
  const [scoreInfo, setScoreInfo] = useState(null) // { correct, total, xpEarned }

  useEffect(() => {
    async function load() {
      const [
        { data: weekData,  error: weekError  },
        { data: cardsData, error: cardsError  },
        { data: statsData, error: statsError  },
      ] = await Promise.all([
        supabase.from('weeks').select('*').eq('id', weekId).single(),
        supabase.from('flashcards').select('*').eq('week_id', weekId).order('created_at', { ascending: false }),
        supabase.from('game_stats').select('*').eq('week_id', weekId).maybeSingle(),
      ])
      if (weekError)  logError('Failed to load week for lotus quest', { page: 'lotus-quest', action: 'fetchData', err: weekError, details: { weekId } })
      if (cardsError) logError('Failed to load cards for lotus quest', { page: 'lotus-quest', action: 'fetchData', err: cardsError, details: { weekId } })
      if (statsError) logError('Failed to load game stats', { page: 'lotus-quest', action: 'fetchData', err: statsError, details: { weekId } })
      setWeek(weekData)
      setCards(cardsData || [])
      setGameStats(statsData)
      setLoading(false)
    }
    load()
  }, [weekId])

  async function handleModeComplete(resultsMap, xpEarned) {
    // Update mastery
    const updated = { ...masteryData }
    for (const [cardId, wasCorrect] of resultsMap) {
      recordResult(cardId, wasCorrect, updated)
    }
    saveMastery(updated)
    setMasteryData(updated)

    // Streak calculation
    const today = new Date().toISOString().split('T')[0]
    const lastPlayed = gameStats?.last_played
    let newStreak = 1
    if (lastPlayed) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      if (lastPlayed === today) newStreak = gameStats.streak_days
      else if (lastPlayed === yesterday) newStreak = (gameStats.streak_days || 0) + 1
    }

    const masteredCount = Object.values(updated).filter(e => e.streak >= 3).length
    const currentXP = loadXP().xp

    const { data: newStats, error: statsUpsertError } = await supabase.from('game_stats').upsert({
      user_id: user.id,
      week_id: weekId,
      xp: currentXP,
      cards_mastered: masteredCount,
      streak_days: newStreak,
      last_played: today,
    }, { onConflict: 'user_id, week_id' }).select().maybeSingle()

    if (statsUpsertError) logError('Failed to upsert game stats', { page: 'lotus-quest', action: 'handleModeComplete', err: statsUpsertError, details: { weekId } })
    if (newStats) setGameStats(newStats)

    const correct = [...resultsMap.values()].filter(Boolean).length
    const total = resultsMap.size
    setScoreInfo({ correct, total, xpEarned })
    setPhase('score')
  }

  function startChunkBuilder() {
    const queue = cards.filter(c => c.breakdown?.length > 0)
    setCbQueue(queue)
    setCbIndex(0)
    setCbResults(new Map())
    setPhase('chunk-builder')
  }

  if (loading) {
    return (
      <div className="pixel-mode min-h-screen flex items-center justify-center">
        <div className="font-pixel-ui text-[#888] text-xs">LOADING...</div>
      </div>
    )
  }

  if (phase === 'word-warrior') {
    return (
      <WordWarrior
        flashcards={cards}
        onComplete={(resultsMap) => {
          const xpEarned = loadXP().xp
          handleModeComplete(resultsMap, xpEarned)
        }}
      />
    )
  }

  if (phase === 'chunk-builder') {
    if (cbIndex < cbQueue.length) {
      const card = cbQueue[cbIndex]
      return (
        <ChunkBuilder
          key={card.id}
          flashcard={card}
          onComplete={(correct) => {
            const updated = new Map(cbResults)
            updated.set(card.id, correct)
            if (cbIndex + 1 >= cbQueue.length) {
              if (correct) addXP(1)
              const xpEarned = [...updated.values()].filter(Boolean).length
              handleModeComplete(updated, xpEarned)
            } else {
              if (correct) addXP(1)
              setCbResults(updated)
              setCbIndex(i => i + 1)
            }
          }}
        />
      )
    }
  }

  if (phase === 'score' && scoreInfo) {
    return (
      <div className="pixel-mode min-h-screen flex flex-col items-center justify-center px-4 py-8 gap-8">
        <div className="font-pixel-ui text-[#F5A623] text-base leading-relaxed text-center">QUEST COMPLETE!</div>
        <div className="font-pixel-ui pixel-border bg-[#1a2030] p-6 flex flex-col gap-4 text-xs leading-loose text-center w-full max-w-xs">
          <div>CORRECT: <span className="text-[#5BAF7A]">{scoreInfo.correct}</span> / {scoreInfo.total}</div>
          <div>XP EARNED: <span className="text-[#F5A623]">+{scoreInfo.xpEarned}</span></div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setPhase('hub')}
            className="font-pixel-ui pixel-border bg-[#1a2030] text-[#e0e0e0] px-6 py-3 text-xs hover:bg-[#243040] active:scale-95 transition-transform cursor-pointer"
          >
            PLAY AGAIN
          </button>
          <button
            onClick={() => onNavigate('week', weekId)}
            className="font-pixel-ui pixel-border bg-[#E8526A] text-white px-6 py-3 text-xs hover:bg-[#c43e56] active:scale-95 transition-transform cursor-pointer"
          >
            BACK TO WEEK
          </button>
        </div>
      </div>
    )
  }

  // Hub
  const hasCards = cards.length > 0
  const hasBreakdowns = cards.some(c => c.breakdown?.length > 0)
  const mastered = Object.values(masteryData).filter(e => e.streak >= 3).length

  return (
    <div className="pixel-mode min-h-screen px-4 py-8 max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="font-pixel-ui font-bold text-[#E8526A] text-xl leading-relaxed mb-2">LOTUS QUEST</div>
        <div className="font-pixel-ui text-[#888] text-[10px]">▸ {week?.title ?? '...'}</div>
      </div>

      {/* Mode grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <ModeCard
          icon="⚔"
          label="WORD WARRIOR"
          description="Defeat cards with your knowledge"
          enabled={hasCards}
          onClick={() => setPhase('word-warrior')}
        />
        <ModeCard
          icon="⚡"
          label="SPEED SCROLL"
          description=""
          enabled={false}
          comingSoon
        />
        <ModeCard
          icon="🧩"
          label="CHUNK BUILDER"
          description="Reassemble Vietnamese phrases"
          enabled={hasBreakdowns}
          onClick={startChunkBuilder}
        />
        <ModeCard
          icon="♪"
          label="TONE TOWER"
          description=""
          enabled={false}
          comingSoon
        />
      </div>

      {/* Stats row */}
      <div className="pixel-border bg-[#1a2030] p-4 flex justify-around text-center text-[10px] leading-loose mb-8">
        <div>
          <div className="font-pixel-score text-[#F5A623]">{loadXP().xp}</div>
          <div className="text-[#888]">XP</div>
        </div>
        <div>
          <div className="font-pixel-score text-[#5BAF7A]">{mastered}</div>
          <div className="text-[#888]">MASTERED</div>
        </div>
        <div>
          <div className="font-pixel-score text-[#e0e0e0]">{gameStats?.streak_days ?? 0}</div>
          <div className="text-[#888]">DAY STREAK</div>
        </div>
      </div>

      {/* Back link */}
      <button
        onClick={() => onNavigate('week', weekId)}
        className="font-pixel-ui block text-[10px] text-[#888] hover:text-[#e0e0e0] transition-colors cursor-pointer"
      >
        ← BACK TO WEEK
      </button>
    </div>
  )
}

function ModeCard({ icon, label, description, enabled, onClick, comingSoon }) {
  return (
    <button
      onClick={enabled ? onClick : undefined}
      disabled={!enabled}
      className={`pixel-border p-4 flex flex-col gap-2 text-left transition-transform ${
        enabled
          ? 'bg-[#1a2030] hover:bg-[#243040] active:scale-95 cursor-pointer'
          : 'bg-[#111518] cursor-default opacity-60'
      }`}
    >
      <div className="text-2xl">{icon}</div>
      <div className="font-pixel-ui text-[10px] text-[#e0e0e0] leading-snug">{label}</div>
      {comingSoon ? (
        <span className="text-[8px] text-[#F5A623] border border-[#F5A623] px-1 py-px w-fit">
          COMING SOON
        </span>
      ) : (
        <div className="text-[8px] text-[#888] leading-snug">{description}</div>
      )}
    </button>
  )
}
