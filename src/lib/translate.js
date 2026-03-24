const GOOGLE_TRANSLATE_URL =
  'https://translation.googleapis.com/language/translate/v2'

export async function translateToEnglish(text) {
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY
  const res = await fetch(
    `${GOOGLE_TRANSLATE_URL}?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: 'vi', target: 'en' }),
    }
  )
  const json = await res.json()
  if (json.error) {
    throw new Error(`Google Translate error ${json.error.code}: ${json.error.message}`)
  }
  const raw = json.data.translations[0].translatedText
  // Google Translate returns HTML-encoded entities (e.g. &#39; for apostrophe)
  const txt = document.createElement('textarea')
  txt.innerHTML = raw
  return txt.value
}
