export async function translateToEnglish(text, sourceLang = 'vi') {
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, source: sourceLang, target: 'en' }),
  })
  const json = await res.json()
  if (json.error) {
    throw new Error(`Google Translate error: ${json.error}`)
  }
  const raw = json.data.translations[0].translatedText
  // Google Translate returns HTML-encoded entities (e.g. &#39; for apostrophe)
  const txt = document.createElement('textarea')
  txt.innerHTML = raw
  return txt.value
}
