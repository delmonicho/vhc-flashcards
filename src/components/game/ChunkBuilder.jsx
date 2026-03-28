import { useState, useEffect, useRef } from 'react'
import { CHUNK_COLORS } from '../../lib/colors'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function ChunkBuilder({ flashcard, onComplete }) {
  const breakdown = flashcard.breakdown || []
  const slotCount = breakdown.length

  const [tiles, setTiles] = useState(() =>
    shuffle(breakdown.map((seg, i) => ({ id: i, seg })))
  )
  const [slots, setSlots] = useState(() => Array(slotCount).fill(null))
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(null)
  const dragId = useRef(null)

  useEffect(() => {
    if (!breakdown.length) onComplete(true)
  }, [])

  if (!breakdown.length) return null

  function placeTile(tile) {
    const emptyIdx = slots.findIndex(s => s === null)
    if (emptyIdx === -1) return
    setSlots(s => s.map((v, i) => i === emptyIdx ? tile : v))
    setTiles(t => t.filter(t => t.id !== tile.id))
  }

  function removeFromSlot(slotIdx) {
    if (submitted) return
    const tile = slots[slotIdx]
    if (!tile) return
    setSlots(s => s.map((v, i) => i === slotIdx ? null : v))
    setTiles(t => [...t, tile])
  }

  function dropIntoSlot(slotIdx) {
    if (dragId.current === null) return
    const tile = tiles.find(t => t.id === dragId.current)
    if (!tile) return
    // If slot is occupied, swap back
    const existing = slots[slotIdx]
    setSlots(s => s.map((v, i) => i === slotIdx ? tile : v))
    setTiles(t => {
      const without = t.filter(t => t.id !== tile.id)
      return existing ? [...without, existing] : without
    })
    dragId.current = null
  }

  function handleSubmit() {
    const correct = slots.every((slot, i) => slot?.id === i)
    setIsCorrect(correct)
    setSubmitted(true)
  }

  const allFilled = slots.every(s => s !== null)

  return (
    <div className="pixel-mode min-h-screen flex flex-col px-4 py-8 gap-6">
      {/* English prompt */}
      <div className="text-center leading-loose text-[#e0e0e0] px-2" style={{ fontFamily: 'var(--font-pixel-viet)', fontSize: 'clamp(16px,3vw,24px)', opacity: 0.85 }}>
        {flashcard.english}
      </div>

      <div className="font-pixel-ui text-[10px] text-[#888] text-center">ARRANGE THE VIETNAMESE CHUNKS IN ORDER</div>

      {/* Target slots */}
      <div className="flex flex-wrap justify-center gap-2">
        {slots.map((slot, i) => {
          const color = slot ? CHUNK_COLORS[slot.id % CHUNK_COLORS.length].pill : null
          let borderClass = 'pixel-border'
          if (submitted && slot) {
            borderClass = slot.id === i ? 'pixel-border-green' : 'pixel-border-red'
          }
          return (
            <div
              key={i}
              style={{ fontFamily: 'var(--font-pixel-viet)' }}
              className={`${borderClass} min-w-[60px] min-h-[40px] flex items-center justify-center px-3 py-2 text-[10px] cursor-pointer ${slot ? color : 'bg-[#1a2030] text-[#555]'}`}
              onClick={() => removeFromSlot(i)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => dropIntoSlot(i)}
            >
              {slot ? slot.seg.vi : '?'}
            </div>
          )
        })}
      </div>

      {/* Tile bank */}
      {!submitted && (
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          {tiles.map(tile => {
            const color = CHUNK_COLORS[tile.id % CHUNK_COLORS.length].pill
            return (
              <div
                key={tile.id}
                draggable
                onDragStart={() => { dragId.current = tile.id }}
                onClick={() => placeTile(tile)}
                style={{ fontFamily: 'var(--font-pixel-viet)' }}
                className={`pixel-border ${color} px-3 py-2 text-[10px] cursor-grab active:cursor-grabbing select-none`}
              >
                {tile.seg.vi}
              </div>
            )
          })}
        </div>
      )}

      {/* Correct answer if wrong */}
      {submitted && !isCorrect && (
        <div className="pixel-border bg-[#1a2030] px-4 py-3 text-center">
          <div className="font-pixel-ui text-[10px] text-[#888] mb-2">CORRECT ORDER:</div>
          <div className="flex flex-wrap justify-center gap-2">
            {breakdown.map((seg, i) => (
              <span key={i} style={{ fontFamily: 'var(--font-pixel-viet)' }} className={`${CHUNK_COLORS[i % CHUNK_COLORS.length].pill} px-2 py-1 text-[10px]`}>
                {seg.vi}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex justify-center mt-2">
        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={!allFilled}
            className="font-pixel-ui pixel-border bg-[#E8526A] text-white px-8 py-3 text-xs disabled:opacity-40 hover:bg-[#c43e56] active:scale-95 transition-transform cursor-pointer"
          >
            SUBMIT
          </button>
        ) : (
          <button
            onClick={() => onComplete(isCorrect)}
            className="font-pixel-ui pixel-border bg-[#5BAF7A] text-white px-8 py-3 text-xs hover:bg-[#4a9468] active:scale-95 transition-transform cursor-pointer"
          >
            CONTINUE
          </button>
        )}
      </div>
    </div>
  )
}
