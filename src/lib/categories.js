import { supabase } from './supabase'
import { logError } from './logger'

const PALETTE = [
  '#FFCCD5', '#FFF0C0', '#D6F5E3', '#D6EEFF', '#EDE4FF',
  '#FFE8D6', '#D6F5F5', '#F5D6FF', '#FFECD6', '#D6FFE8',
]

const STORAGE_KEY = 'viet-categories'

// Fetch categories from Supabase. On first run, migrates any existing localStorage
// categories to the DB, then removes the localStorage key.
export async function loadCategories() {
  // One-time migration: if localStorage has categories, upsert them to Supabase first
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const local = JSON.parse(stored)
      if (Array.isArray(local) && local.length > 0) {
        await supabase.from('categories').upsert(
          local.map(({ id, label, color }) => ({ id, label, color })),
          { onConflict: 'id' }
        )
      }
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch (err) {
    logError('Failed to migrate categories from localStorage', { action: 'loadCategories', err })
  }

  const { data } = await supabase.from('categories').select('id, label, color').order('created_at')
  return data ?? []
}

export function getCategoryColor(categories, sourceId) {
  return categories.find(c => c.id === sourceId)?.color ?? '#E0E0E0'
}

export function nextColor(categories) {
  const used = new Set(categories.map(c => c.color))
  return PALETTE.find(c => !used.has(c)) ?? PALETTE[categories.length % PALETTE.length]
}

// Returns the new category object. Caller updates React state via onCategoriesChange.
export async function addCategory(categories, label) {
  const trimmed = label.trim()
  let id = trimmed.toLowerCase().replace(/\s+/g, '-')
  let suffix = 2
  while (categories.some(c => c.id === id)) {
    id = `${trimmed.toLowerCase().replace(/\s+/g, '-')}-${suffix++}`
  }
  const color = nextColor(categories)
  await supabase.from('categories').insert({ id, label: trimmed, color })
  return { id, label: trimmed, color }
}

// Returns the filtered list. Caller updates React state via onCategoriesChange.
export async function deleteCategory(categories, categoryId) {
  await supabase.from('categories').delete().eq('id', categoryId)
  return categories.filter(c => c.id !== categoryId)
}

// Upsert a batch of recovered categories (from orphaned card tags).
export async function upsertCategories(cats) {
  await supabase.from('categories').upsert(cats, { onConflict: 'id' })
}
