import { CHUNK_COLORS } from '../lib/colors'

function SpeakerIcon({ active, className = 'w-3.5 h-3.5' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`${className} shrink-0 ${active ? 'animate-pulse' : ''}`}
      aria-hidden="true"
    >
      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.241 1.518 1.905 2.659 1.905H6.44l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
      <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
    </svg>
  )
}

export default function BreakdownDisplay({
  breakdown,
  onSpeakChunk,
  onSpeakFull,
  speakingKey,
}) {
  if (!breakdown || breakdown.length === 0) return null

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
      <div className="text-xs text-gray-400 dark:text-gray-600 uppercase tracking-wide mb-2">
        breakdown
      </div>
      <div className="space-y-1.5">
        {/* Vietnamese row — each pill is a speak button */}
        <div className="flex flex-wrap gap-1.5">
          {breakdown.map((seg, i) => {
            const key = `chunk-${i}`
            const active = speakingKey === key
            return onSpeakChunk ? (
              <button
                key={i}
                onClick={() => onSpeakChunk(i, seg.vi)}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium min-h-[2.75rem] transition-opacity ${CHUNK_COLORS[i % CHUNK_COLORS.length].pill}`}
                aria-label={`Pronounce: ${seg.vi}`}
              >
                {seg.vi}
                <SpeakerIcon active={active} />
              </button>
            ) : (
              <span
                key={i}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${CHUNK_COLORS[i % CHUNK_COLORS.length].pill}`}
              >
                {seg.vi}
              </span>
            )
          })}
        </div>

        {/* English row — static */}
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

      {/* Hear full phrase */}
      {onSpeakFull && (
        <button
          onClick={onSpeakFull}
          className="mt-3 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="Hear full phrase"
        >
          <SpeakerIcon active={speakingKey === 'full'} className="w-3.5 h-3.5" />
          Hear full phrase
        </button>
      )}
    </div>
  )
}
