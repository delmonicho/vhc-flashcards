import { getMasteryStats } from '../lib/mastery'

// Stage metadata — order matches stage indices 0–4
export const STAGES = [
  { key: 'unseen',    label: 'Unseen',    className: 'bg-gray-200 dark:bg-gray-700' },
  { key: 'learning',  label: 'Learning',  className: 'bg-co-primary' },
  { key: 'familiar',  label: 'Familiar',  className: 'bg-co-gold' },
  { key: 'confident', label: 'Confident', className: 'bg-blue-400' },
  { key: 'mastered',  label: 'Mastered',  className: 'bg-co-fern' },
]

// Pixel-mode color map for LotusQuest (maps stage keys to hex)
const PIXEL_COLORS = {
  unseen:    '#3a3a4a',
  learning:  '#E8526A',
  familiar:  '#F5A623',
  confident: '#6090D0',
  mastered:  '#5BAF7A',
}

/**
 * MasteryBar — visualises mastery stage distribution for a set of cards.
 *
 * Props:
 *   cards        – array of card objects (used for total count)
 *   masteryData  – mastery store { [cardId]: entry }
 *   compact      – if true, renders a slim bar with no labels (for pixel UI)
 *   pixel        – if true, uses hard-coded pixel hex colors instead of Tailwind classes
 *   showCounts   – show per-stage counts below the bar (default true when !compact)
 */
export default function MasteryBar({ cards, masteryData, compact = false, pixel = false, showCounts }) {
  const show = showCounts ?? !compact
  const stats = getMasteryStats(cards, masteryData)
  const total = stats.total || 1 // avoid /0

  if (pixel) {
    return (
      <div className="w-full">
        {/* Segmented bar */}
        <div className="flex h-2 rounded-sm overflow-hidden gap-px">
          {STAGES.map(({ key }) => {
            const pct = (stats[key] / total) * 100
            if (pct === 0) return null
            return (
              <div
                key={key}
                style={{ width: `${pct}%`, background: PIXEL_COLORS[key] }}
              />
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Segmented bar */}
      <div className={`flex ${compact ? 'h-2' : 'h-3'} rounded-full overflow-hidden gap-px`}>
        {STAGES.map(({ key, className }) => {
          const pct = (stats[key] / total) * 100
          if (pct === 0) return null
          return (
            <div
              key={key}
              className={`${className} transition-all duration-500`}
              style={{ width: `${pct}%` }}
            />
          )
        })}
      </div>

      {/* Counts */}
      {show && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {STAGES.map(({ key, label, className }) => {
            const count = stats[key]
            if (count === 0) return null
            return (
              <span key={key} className="flex items-center gap-1 text-xs text-co-muted dark:text-gray-400">
                <span className={`inline-block w-2 h-2 rounded-sm ${className}`} />
                {count} {label}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
