import pdfParse from 'pdf-parse/lib/pdf-parse.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { pdf } = req.body
  if (!pdf) return res.status(400).json({ error: 'Missing pdf field' })

  const buffer = Buffer.from(pdf, 'base64')
  if (buffer.length > 3_145_728) return res.status(413).json({ error: 'PDF too large (max 3MB)' })

  try {
    const { text } = await pdfParse(buffer)
    return res.status(200).json({ text })
  } catch {
    return res.status(500).json({ error: 'Failed to parse PDF' })
  }
}
