import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { loadMastery, saveMastery, recordResult, loadXP, addXP, getMasteryStats, getMasteryStage, syncMasteryToSupabase } from '../lib/mastery'
import { logError } from '../lib/logger'
import { useAuth } from '../context/AuthContext'
import MasteryBar from '../components/MasteryBar'
import WordWarrior from '../components/game/WordWarrior'
import ChunkBuilder from '../components/game/ChunkBuilder'

export default function LotusQuest({ deckId, onNavigate }) {
  const { user } = useAuth()
  const [phase, setPhase] = useState('hub') // 'hub' | 'word-warrior' | 'chunk-builder' | 'score'
  const [cards, setCards] = useState([])
  const [deck, setDeck] = useState(null)
  const [gameStats, setGameStats] = useState(null)
  const [masteryData, setMasteryData] = useState(() => loadMastery())
  const [loading, setLoading] = useState(true)

  // Chunk builder queue state
  const [cbQueue, setCbQueue] = useState([])
  const [cbIndex, setCbIndex] = useState(0)
  const [cbResults, setCbResults] = useState(new Map())

  // Score state
  const [scoreInfo, setScoreInfo] = useState(null) // { correct, total }

  useEffect(() => {
    async function load() {
      const [
        { data: deckData, error: deckError },
        { data: cardsData, error: cardsError },
        { data: statsData, error: statsError },
      ] = await Promise.all([
        supabase.from('decks').select('*').eq('id', deckId).single(),
        supabase.from('flashcards').select('*').eq('deck_id', deckId).order('created_at', { ascending: false }),
        supabase.from('game_stats').select('*').eq('deck_id', deckId).maybeSingle(),
      ])
      if (deckError) logError('Failed to load deck for lotus quest', { page: 'lotus-quest', action: 'fetchData', err: deckError, details: { deckId } })
      if (cardsError) logError('Failed to load cards for lotus quest', { page: 'lotus-quest', action: 'fetchData', err: cardsError, details: { deckId } })
      if (statsError) logError('Failed to load game stats', { page: 'lotus-quest', action: 'fetchData', err: statsError, details: { deckId } })
      setDeck(deckData)
      setCards(cardsData || [])
      setGameStats(statsData)
      setLoading(false)
    }
    load()
  }, [deckId])

  async function handleModeComplete(resultsMap, xpEarned) {
    // Update mastery
    const updated = { ...masteryData }
    for (const [cardId, wasCorrect] of resultsMap) {
      recordResult(cardId, wasCorrect, updated)
    }
    saveMastery(updated)
    setMasteryData(updated)

    // Sync mastery to Supabase (fire-and-forget)
    syncMasteryToSupabase([...resultsMap.keys()], user?.id, deckId, updated, supabase)

    // Streak calculation
    const today = new Date().toISOString().split('T')[0]
    const lastPlayed = gameStats?.last_played
    let newStreak = 1
    if (lastPlayed) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      if (lastPlayed === today) newStreak = gameStats.streak_days
      else if (lastPlayed === yesterday) newStreak = (gameStats.streak_days || 0) + 1
    }

    const masteredCount = Object.values(updated).filter(e => getMasteryStage(e) === 4).length
    const currentXP = loadXP().xp

    const { data: newStats, error: statsUpsertError } = await supabase.from('game_stats').upsert({
      user_id: user.id,
      deck_id: deckId,
      xp: currentXP,
      cards_mastered: masteredCount,
      streak_days: newStreak,
      last_played: today,
    }, { onConflict: 'user_id, deck_id' }).select().maybeSingle()

    if (statsUpsertError) logError('Failed to upsert game stats', { page: 'lotus-quest', action: 'handleModeComplete', err: statsUpsertError, details: { deckId } })
    if (newStats) setGameStats(newStats)

    const correct = [...resultsMap.values()].filter(Boolean).length
    const total = resultsMap.size
    setScoreInfo({ correct, total })
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
      <div className="pixel-mode min-h-screen w-full flex items-center justify-center">
        <div className="font-pixel-ui text-[#888] text-sm">LOADING...</div>
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
    const stats = getMasteryStats(cards, masteryData)
    return (
      <div className="pixel-mode min-h-screen w-full flex flex-col items-center justify-center px-4 py-8 gap-8">
        <div className="font-pixel-ui text-[#F5A623] text-xl leading-relaxed text-center">QUEST COMPLETE!</div>
        <div className="font-pixel-ui pixel-border bg-[#1a2030] p-8 flex flex-col gap-4 text-sm leading-loose text-center w-full max-w-sm">
          <div>CORRECT: <span className="text-[#5BAF7A]">{scoreInfo.correct}</span> / {scoreInfo.total}</div>
          <div className="space-y-1">
            <div className="text-[#888] mb-1">DECK PROGRESS</div>
            <MasteryBar cards={cards} masteryData={masteryData} compact pixel />
            <div className="text-[#5BAF7A]">{stats.mastered} MASTERED</div>
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setPhase('hub')}
            className="font-pixel-ui pixel-border bg-[#1a2030] text-[#e0e0e0] px-6 py-4 text-sm hover:bg-[#243040] active:scale-95 transition-transform cursor-pointer"
          >
            PLAY AGAIN
          </button>
          <button
            onClick={() => onNavigate('deck', deckId)}
            className="font-pixel-ui pixel-border bg-[#E8526A] text-white px-6 py-4 text-sm hover:bg-[#c43e56] active:scale-95 transition-transform cursor-pointer"
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
  const stats = getMasteryStats(cards, masteryData)

  return (
    <div className="pixel-mode min-h-screen w-full">
      <div className="max-w-2xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="font-pixel-ui font-bold text-co-primary text-3xl leading-relaxed mb-2">LOTUS QUEST</div>
          <div className="font-pixel-ui text-[#888] text-sm">▸ {deck?.title ?? '...'}</div>
        </div>

        {/* Mode grid */}
        <div className="grid grid-cols-2 gap-5 mb-10">
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
        <div className="pixel-border bg-[#1a2030] p-6 flex justify-around text-center text-sm leading-loose mb-10">
          <div>
            <div className="font-pixel-score text-co-gold text-lg">{loadXP().xp}</div>
            <div className="text-[#888]">XP</div>
          </div>
          <div>
            <div className="font-pixel-score text-co-fern text-lg">{mastered}</div>
            <div className="text-[#888]">MASTERED</div>
          </div>
          <div>
            <div className="font-pixel-score text-[#e0e0e0] text-lg">{gameStats?.streak_days ?? 0}</div>
            <div className="text-[#888]">DAY STREAK</div>
          </div>
        </div>

        {/* Back link */}
        <button
          onClick={() => onNavigate('deck', deckId)}
          className="font-pixel-ui block text-sm text-[#888] hover:text-[#e0e0e0] transition-colors cursor-pointer"
        >
          ← BACK TO WEEK
        </button>
      </div>
    </div>
  )
}

function ModeCard({ icon, label, description, enabled, onClick, comingSoon }) {
  return (
    <button
      onClick={enabled ? onClick : undefined}
      disabled={!enabled}
      className={`pixel-border p-4 flex flex-col gap-2 text-left transition-transform ${enabled
          ? 'bg-[#1a2030] hover:bg-[#243040] active:scale-95 cursor-pointer'
          : 'bg-[#111518] cursor-default opacity-60'
        }`}
    >
      <div className="text-3xl">{icon}</div>
      <div className="font-pixel-ui text-sm text-[#e0e0e0] leading-snug">{label}</div>
      {comingSoon ? (
        <span className="text-xs text-co-gold border border-co-gold px-1 py-px w-fit">
          COMING SOON
        </span>
      ) : (
        <div className="text-xs text-[#888] leading-snug">{description}</div>
      )}
    </button>
  )
}
