import { supabase } from './supabase'

const MAX_PDF_BYTES = 3_145_728 // 3 MB

export async function parsePdfToCards(file) {
  if (file.size > MAX_PDF_BYTES) {
    throw new Error('File is too large. Maximum size is 3MB.')
  }

  const pdfBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // reader.result is a data URL: "data:application/pdf;base64,..."
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })

  const { data, error } = await supabase.functions.invoke('parse-vocab', {
    body: { pdfBase64 },
  })
  if (error) throw new Error(error.message ?? 'PDF parsing failed')
  return {
    pairs: data.pairs ?? [],
    suggestedTags: data.suggestedTags ?? [],
    truncated: data.truncated ?? false,
  }
}
