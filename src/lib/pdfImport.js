import { supabase } from './supabase'

export async function extractPdfText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async () => {
      // reader.result is a data URL: "data:application/pdf;base64,..."
      const base64 = reader.result.split(',')[1]
      try {
        const res = await fetch('/api/pdf-extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdf: base64 }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'PDF extraction failed')
        resolve(data.text)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export async function parseVocabPairs(text) {
  const { data, error } = await supabase.functions.invoke('parse-vocab', {
    body: { text },
  })
  if (error) throw new Error(error.message ?? 'Vocabulary parsing failed')
  return { pairs: data.pairs, suggestedTags: data.suggestedTags ?? [], truncated: data.truncated ?? false }
}
