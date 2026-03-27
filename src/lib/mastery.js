export function loadMastery() {
  try {
    return JSON.parse(localStorage.getItem('quiz-mastery') || '{}')
  } catch {
    return {}
  }
}

export function saveMastery(data) {
  localStorage.setItem('quiz-mastery', JSON.stringify(data))
}

export function recordResult(cardId, wasCorrect, store) {
  const entry = store[cardId] || { correct: 0, incorrect: 0, streak: 0, lastSeen: 0 }
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

export function getWeight(cardId, store) {
  const entry = store[cardId]
  if (!entry) return 1
  return (entry.streak < 3 && entry.incorrect > 0) ? 2 : 1
}

export function weightedSample(cards, n, store) {
  // Cards with weight=2 appear twice in pool before sampling
  const pool = []
  for (const card of cards) {
    pool.push(card)
    if (getWeight(card.id, store) === 2) pool.push(card)
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
  } catch {
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
