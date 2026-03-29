const GOOGLE_TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GOOGLE_API_KEY
  const { q, source, target } = req.body

  try {
    const response = await fetch(`${GOOGLE_TRANSLATE_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, source, target }),
    })
    const data = await response.json()
    if (data.error) {
      return res.status(500).json({ error: 'Translation failed' })
    }
    return res.status(200).json(data)
  } catch {
    return res.status(500).json({ error: 'Translation failed' })
  }
}
