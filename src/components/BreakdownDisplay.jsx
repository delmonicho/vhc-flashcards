import { CHUNK_COLORS } from '../lib/colors'

export default function BreakdownDisplay({ breakdown }) {
  if (!breakdown || breakdown.length === 0) return null

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
      <div className="text-xs text-gray-400 dark:text-gray-600 uppercase tracking-wide mb-2">
        breakdown
      </div>
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1.5">
          {breakdown.map((seg, i) => (
            <span
              key={i}
              className={`px-3 py-1 rounded-lg text-sm font-medium ${CHUNK_COLORS[i % CHUNK_COLORS.length].pill}`}
            >
              {seg.vi}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {breakdown.map((seg, i) => (
            <span
              key={i}
              className={`px-3 py-1 rounded-lg text-sm font-medium ${CHUNK_COLORS[i % CHUNK_COLORS.length].pill}`}
            >
              {seg.en}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
