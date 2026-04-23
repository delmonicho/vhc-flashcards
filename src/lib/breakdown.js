import { supabase } from './supabase'
import { logError } from './logger'

export function normalizeVietnamese(text) {
  return normalizePhrase(text, 'vi')
}

// Returns a cache key prefixed with language to avoid collisions between languages.
// e.g. 'vi:xin chào', 'zh-Hans:你好', 'zh-TW:你好'
export function normalizePhrase(text, lang) {
  return `${lang}:${text.trim().replace(/\s+/g, ' ')}`
}

export function stripDiacritics(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export async function getOrCreateBreakdown(vietnameseText, cardId, englishText, lang = 'vi', script = null) {
  const viKey = normalizePhrase(vietnameseText, lang === 'zh' ? (script === 'traditional' ? 'zh-TW' : 'zh-Hans') : lang)

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
  const { data: fnData, error: fnError } = await supabase.functions.invoke('generate-breakdown', {
    body: {
      vietnamese: vietnameseText,
      ...(englishText && { english: englishText }),
      lang,
      ...(script && { script }),
    },
  })

  if (fnError) throw new Error(`Breakdown generation failed: ${fnError.message}`)

  const { breakdown } = fnData

  if (!Array.isArray(breakdown) || !breakdown[0]?.vi) {
    throw new Error('Breakdown generation failed: unexpected response format')
  }

  // 3. Persist to cache (upsert handles race conditions)
  const { error: cacheError } = await supabase
    .from('breakdowns')
    .upsert({ vi_key: viKey, breakdown }, { onConflict: 'vi_key' })
  if (cacheError) logError('Failed to cache breakdown', { action: 'breakdown-cache-write', err: cacheError, details: { vi_key: viKey } })

  // 4. Write to flashcard
  await supabase.from('flashcards').update({ breakdown }).eq('id', cardId)

  return breakdown
}

// Optimized batch version for bulk import flows.
// Reduces N cache reads + N cache writes + N flashcard updates → 1 + 1 + 1.
// Claude API calls go from N concurrent to ceil(misses/20) sequential batch calls.
// onCardReady(cardId, breakdown) is called as each breakdown becomes available.
export async function batchGetOrCreateBreakdowns(cards, onCardReady, lang = 'vi', script = null) {
  if (cards.length === 0) return

  const langKey = lang === 'zh' ? (script === 'traditional' ? 'zh-TW' : 'zh-Hans') : lang
  const viKeys = cards.map(c => normalizePhrase(c.vietnamese, langKey))

  // 1. Single batch cache lookup
  const { data: cached } = await supabase
    .from('breakdowns')
    .select('vi_key, breakdown')
    .in('vi_key', viKeys)

  const cacheMap = new Map((cached ?? []).map(r => [r.vi_key, r.breakdown]))
  const hits = cards.filter(c => cacheMap.has(normalizePhrase(c.vietnamese, langKey)))
  const misses = cards.filter(c => !cacheMap.has(normalizePhrase(c.vietnamese, langKey)))

  // Notify UI for cache hits immediately
  hits.forEach(card => onCardReady(card.id, cacheMap.get(normalizePhrase(card.vietnamese, langKey))))

  // 2. Batch generate for cache misses — one Claude call per chunk of 20 (sequential)
  // De-duplicate by vi_key first so identical words only get generated once
  const uniqueMisses = [...new Map(misses.map(c => [normalizePhrase(c.vietnamese, langKey), c])).values()]
  const batchResultMap = new Map() // vi_key → breakdown

  const CHUNK_SIZE = 20
  for (let i = 0; i < uniqueMisses.length; i += CHUNK_SIZE) {
    const chunk = uniqueMisses.slice(i, i + CHUNK_SIZE)
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('batch-breakdown', {
        body: {
          cards: chunk.map(c => ({ vietnamese: c.vietnamese, english: c.english })),
          lang,
          ...(script && { script }),
        },
      })
      if (fnError) throw new Error(fnError.message)
      const { results } = fnData ?? {}
      if (Array.isArray(results)) {
        results.forEach((item, idx) => {
          const bd = item?.breakdown
          if (Array.isArray(bd) && bd[0]?.vi) {
            batchResultMap.set(normalizePhrase(chunk[idx].vietnamese, langKey), bd)
          }
        })
      }
    } catch (err) {
      logError('Batch breakdown chunk failed', { action: 'batch-breakdown', err, details: { chunkSize: chunk.length } })
    }
  }

  // Apply results to all miss cards (including any with duplicate vi_keys)
  const generated = []
  for (const card of misses) {
    const vk = normalizePhrase(card.vietnamese, langKey)
    const bd = batchResultMap.get(vk)
    if (bd) {
      generated.push({ vi_key: vk, breakdown: bd, cardId: card.id })
      onCardReady(card.id, bd)
    }
  }

  // 3. Batch upsert new breakdowns to cache (deduplicated by vi_key)
  const cacheRows = [...new Map(generated.map(g => [g.vi_key, { vi_key: g.vi_key, breakdown: g.breakdown }])).values()]
  if (cacheRows.length > 0) {
    const { error } = await supabase
      .from('breakdowns')
      .upsert(cacheRows, { onConflict: 'vi_key' })
    if (error) logError('Failed to batch cache breakdowns', { action: 'batch-breakdown-cache', err: error })
  }

  // 4. Bulk update flashcard.breakdown — single RPC call for all cards (hits + generated)
  const flashcardUpdates = [
    ...hits.map(card => ({ id: card.id, breakdown: cacheMap.get(normalizePhrase(card.vietnamese, langKey)) })),
    ...generated.map(({ cardId, breakdown }) => ({ id: cardId, breakdown })),
  ]
  if (flashcardUpdates.length > 0) {
    const { error } = await supabase.rpc('bulk_update_card_breakdowns', { updates: flashcardUpdates })
    if (error) logError('Failed to bulk update card breakdowns', { action: 'bulk-breakdown-write', err: error })
  }
}

export async function triggerMissingBreakdowns() {
  const { data: cards, error } = await supabase
    .from('flashcards')
    .select('id, vietnamese, english')
    .is('breakdown', null)

  if (error) throw new Error(`Failed to fetch cards: ${error.message}`)

  let failed = 0
  for (const c of cards) {
    try {
      await getOrCreateBreakdown(c.vietnamese, c.id, c.english)
    } catch {
      failed++
    }
  }
  return { total: cards.length, failed }
}

export async function backfillBreakdownCache() {
  const { data: cards, error } = await supabase
    .from('flashcards')
    .select('vietnamese, breakdown')
    .not('breakdown', 'is', null)

  if (error) throw new Error(`Failed to fetch flashcards: ${error.message}`)

  const rows = cards.map(c => ({
    vi_key: normalizeVietnamese(c.vietnamese),
    breakdown: c.breakdown,
  }))

  // Deduplicate by vi_key (last write wins for duplicate phrases)
  const unique = Object.values(Object.fromEntries(rows.map(r => [r.vi_key, r])))

  const { error: upsertError } = await supabase
    .from('breakdowns')
    .upsert(unique, { onConflict: 'vi_key' })

  if (upsertError) throw new Error(`Backfill upsert failed: ${upsertError.message}`)

  return unique.length
}
