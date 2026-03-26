const PALETTE = [
  '#FFCCD5', '#FFF0C0', '#D6F5E3', '#D6EEFF', '#EDE4FF',
  '#FFE8D6', '#D6F5F5', '#F5D6FF', '#FFECD6', '#D6FFE8',
]

const DEFAULTS = [
  { id: 'class',    label: 'Class',    color: '#FFCCD5' },
  { id: 'homework', label: 'Homework', color: '#FFF0C0' },
]

const STORAGE_KEY = 'viet-categories'

export function loadCategories() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return DEFAULTS
}

export function saveCategories(categories) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(categories))
}

export function getCategoryColor(categories, sourceId) {
  return categories.find(c => c.id === sourceId)?.color ?? '#E0E0E0'
}

export function nextColor(categories) {
  const used = new Set(categories.map(c => c.color))
  return PALETTE.find(c => !used.has(c)) ?? PALETTE[categories.length % PALETTE.length]
}

export function addCategory(categories, label) {
  const trimmed = label.trim()
  let id = trimmed.toLowerCase().replace(/\s+/g, '-')
  // Deduplicate id if collision
  let suffix = 2
  while (categories.some(c => c.id === id)) {
    id = `${trimmed.toLowerCase().replace(/\s+/g, '-')}-${suffix++}`
  }
  const color = nextColor(categories)
  return [...categories, { id, label: trimmed, color }]
}
