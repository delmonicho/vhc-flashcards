import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export function normalizeVietnamese(text) {
  return text.trim().replace(/\s+/g, ' ')
}

export async function getOrCreateBreakdown(vietnameseText, cardId) {
  const viKey = normalizeVietnamese(vietnameseText)

  // 1. Cache lookup — reuse existing breakdown for this phrase
  const { data } = await supabase
    .from('breakdowns')
    .select('breakdown')
    .eq('vi_key', viKey)
    .maybeSingle()

  if (data) {
    await supabase.from('flashcards').update({ breakdown: data.breakdown }).eq('id', cardId)
    return data.breakdown
  }

  // 2. Generate via Edge Function (proxies Anthropic to avoid CORS)
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-breakdown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vietnamese: vietnameseText }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Breakdown generation failed: ${err?.error || res.statusText}`)
  }

  const { breakdown } = await res.json()

  if (!Array.isArray(breakdown) || !breakdown[0]?.vi) {
    throw new Error('Breakdown generation failed: unexpected response format')
  }

  // 3. Persist to cache (upsert handles race conditions)
  const { error: cacheError } = await supabase
    .from('breakdowns')
    .upsert({ vi_key: viKey, breakdown }, { onConflict: 'vi_key' })
  if (cacheError) console.error('Failed to cache breakdown:', cacheError.message)

  // 4. Write to flashcard
  await supabase.from('flashcards').update({ breakdown }).eq('id', cardId)

  return breakdown
}
