export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const hfToken = process.env.HF_TOKEN
  if (!hfToken) {
    console.error('[transcribe] HF_TOKEN is not set')
    return res.status(500).json({ error: 'HF_TOKEN not configured' })
  }

  const { audio, mimeType = 'audio/webm' } = req.body
  if (!audio) return res.status(400).json({ error: 'Missing audio field' })

  // Decode base64 → raw binary for HF Inference API
  const buffer = Buffer.from(audio, 'base64')

  try {
    // HF Inference Providers API — send raw binary audio (not JSON)
    // whisper-small is fast on the free tier and supports Vietnamese
    const response = await fetch(
      'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfToken}`,
          'Content-Type': mimeType,
        },
        body: buffer,
      }
    )

    if (response.status === 503) {
      const data = await response.json().catch(() => ({}))
      console.error('[transcribe] HF 503 model loading, estimated_time:', data.estimated_time)
      return res.status(503).json({
        error: 'model_loading',
        retryAfter: Math.ceil(data.estimated_time ?? 20),
      })
    }

    if (response.status === 504) {
      console.error('[transcribe] HF 504 timeout — model took too long')
      return res.status(504).json({ error: 'timeout', detail: 'Transcription timed out — try a shorter recording' })
    }

    if (!response.ok) {
      const body = await response.text()
      console.error('[transcribe] HF error', response.status, body.slice(0, 300))
      return res.status(500).json({ error: 'Transcription failed', hfStatus: response.status, detail: body.slice(0, 200) })
    }

    const data = await response.json()
    const text = data.text ?? data[0]?.text ?? ''
    return res.status(200).json({ text })
  } catch (err) {
    console.error('[transcribe] Unexpected error:', err)
    return res.status(500).json({ error: 'Transcription failed' })
  }
}
