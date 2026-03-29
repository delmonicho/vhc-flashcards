import { logError } from './logger'

export function loadMastery() {
  try {
    return JSON.parse(localStorage.getItem('quiz-mastery') || '{}')
  } catch (err) {
    logError('Failed to parse quiz-mastery from localStorage', { action: 'loadMastery', err })
    return {}
  }
}

export function saveMastery(data) {
  localStorage.setItem('quiz-mastery', JSON.stringify(data))
}

export function recordResult(cardId, wasCorrect, store) {
  const entry = store[cardId] || { correct: 0, incorrect: 0, streak: 0, lastSeen: 0, sessionsCount: 0 }

  // Increment sessionsCount when crossing a calendar day boundary
  if (entry.lastSeen) {
    const lastDay = new Date(entry.lastSeen).toDateString()
    const today = new Date().toDateString()
    if (lastDay !== today) {
      entry.sessionsCount = (entry.sessionsCount || 0) + 1
    }
  } else {
    // First time seeing this card
    entry.sessionsCount = 1
  }

  if (wasCorrect) {
    entry.correct += 1
    entry.streak += 1
  } else {
    entry.incorrect += 1
    entry.streak = 0
  }
  entry.lastSeen = Date.now()
  store[cardId] = entry
}

// Returns 0–4 mastery stage for a single card entry.
// 0 = Unseen, 1 = Learning, 2 = Familiar, 3 = Confident, 4 = Mastered
export function getMasteryStage(entry) {
  if (!entry) return 0
  const { correct, incorrect, streak, sessionsCount = 1 } = entry
  const total = correct + incorrect
  const accuracy = total > 0 ? correct / total : 0

  if (streak >= 5 && accuracy >= 0.70 && sessionsCount >= 2) return 4
  if (streak >= 4 && accuracy >= 0.60) return 3
  if (streak >= 2) return 2
  return 1
}

// Returns stage counts for a set of cards against the mastery store.
// { unseen, learning, familiar, confident, mastered, total }
export function getMasteryStats(cards, store) {
  const counts = { unseen: 0, learning: 0, familiar: 0, confident: 0, mastered: 0, total: cards.length }
  const stageKeys = ['unseen', 'learning', 'familiar', 'confident', 'mastered']
  for (const card of cards) {
    const stage = getMasteryStage(store[card.id])
    counts[stageKeys[stage]] += 1
  }
  return counts
}

export function getWeight(cardId, store) {
  const stage = getMasteryStage(store[cardId])
  // Stage 1 (Learning) prioritized heavily; stage 4 (Mastered) sampled sparingly
  const weights = [1.0, 2.5, 2.0, 1.5, 0.5]
  return weights[stage]
}

export function weightedSample(cards, n, store) {
  // Build pool: each card appears ⌈weight⌉ times proportionally
  const pool = []
  for (const card of cards) {
    const w = getWeight(card.id, store)
    const copies = w >= 2 ? 2 : w >= 1.5 ? 2 : w >= 1 ? 1 : 1
    for (let i = 0; i < copies; i++) pool.push(card)
  }
  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]]
  }
  // Deduplicate by id, take n
  const seen = new Set()
  const result = []
  for (const card of pool) {
    if (!seen.has(card.id)) {
      seen.add(card.id)
      result.push(card)
      if (result.length >= n) break
    }
  }
  return result
}

export function getMissedCards(cards, resultsMap) {
  return cards.filter(c => resultsMap.get(c.id) === false)
}

export function getWeekStart() {
  const now = new Date()
  const day = now.getUTCDay() // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + diff)
  monday.setUTCHours(0, 0, 0, 0)
  return monday.getTime()
}

export function loadXP() {
  try {
    const data = JSON.parse(localStorage.getItem('quiz-xp') || 'null')
    const currentWeekStart = getWeekStart()
    if (!data || data.weekStart !== currentWeekStart) {
      return { weekStart: currentWeekStart, xp: 0 }
    }
    return data
  } catch (err) {
    logError('Failed to parse quiz-xp from localStorage', { action: 'loadXP', err })
    return { weekStart: getWeekStart(), xp: 0 }
  }
}

export function addXP(amount) {
  const data = loadXP()
  data.xp += amount
  localStorage.setItem('quiz-xp', JSON.stringify(data))
  return data.xp
}

export const XP_RATES = { mc: 1, match: 2, quickfire: 1, tiles: 1.5 }

// ─── Supabase sync ─────────────────────────────────────────────────────────

// Converts a localStorage mastery entry to the card_mastery DB shape.
function entryToRow(userId, cardId, deckId, entry) {
  return {
    user_id: userId,
    card_id: cardId,
    deck_id: deckId,
    correct: entry.correct ?? 0,
    incorrect: entry.incorrect ?? 0,
    streak: entry.streak ?? 0,
    last_seen: entry.lastSeen ? new Date(entry.lastSeen).toISOString() : null,
    sessions_count: entry.sessionsCount ?? 1,
  }
}

// Upserts changed card mastery entries to Supabase. Fire-and-forget — does not throw.
// changedCardIds: array of card IDs that changed during this session
// store: the full mastery store (localStorage format)
export function syncMasteryToSupabase(changedCardIds, userId, deckId, store, supabaseClient) {
  if (!changedCardIds.length || !userId) return
  const rows = changedCardIds
    .filter(id => store[id])
    .map(id => entryToRow(userId, id, deckId, store[id]))
  if (!rows.length) return
  supabaseClient
    .from('card_mastery')
    .upsert(rows, { onConflict: 'user_id, card_id' })
    .then(({ error }) => {
      if (error) logError('Failed to sync card mastery', { action: 'syncMasteryToSupabase', err: error })
    })
}

// Loads all card_mastery rows for a user from Supabase and returns them in
// localStorage store format: { [cardId]: { correct, incorrect, streak, lastSeen, sessionsCount } }
export async function loadMasteryFromSupabase(userId, supabaseClient) {
  const { data, error } = await supabaseClient
    .from('card_mastery')
    .select('card_id, correct, incorrect, streak, last_seen, sessions_count')
    .eq('user_id', userId)
  if (error) {
    logError('Failed to load card mastery from Supabase', { action: 'loadMasteryFromSupabase', err: error })
    return {}
  }
  const store = {}
  for (const row of data ?? []) {
    store[row.card_id] = {
      correct: row.correct,
      incorrect: row.incorrect,
      streak: row.streak,
      lastSeen: row.last_seen ? new Date(row.last_seen).getTime() : 0,
      sessionsCount: row.sessions_count,
    }
  }
  return store
}

// One-time migration: pushes existing localStorage mastery to Supabase.
// Safe to re-run — uses ON CONFLICT DO NOTHING so existing Supabase rows win.
// deckId is used only when a card's deck_id is not known locally; pass null to skip unknown cards.
export async function migrateLocalToSupabase(userId, deckCardMap, supabaseClient) {
  // deckCardMap: { [cardId]: deckId } — lets us resolve deck_id for each card
  const local = loadMastery()
  const ids = Object.keys(local)
  if (!ids.length) return
  const rows = ids
    .filter(id => deckCardMap[id])
    .map(id => entryToRow(userId, id, deckCardMap[id], local[id]))
  if (!rows.length) return
  const { error } = await supabaseClient
    .from('card_mastery')
    .upsert(rows, { onConflict: 'user_id, card_id', ignoreDuplicates: true })
  if (error) logError('Failed to migrate local mastery to Supabase', { action: 'migrateLocalToSupabase', err: error })
}
