import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `You are a Vietnamese language assistant extracting flashcard vocabulary from class materials.

EXTRACT as separate cards — tag each pair with its section:
- Vocabulary lists ("word = meaning", "word : meaning") → tag "vocabulary"
- Antonym pairs ("trễ = late >< sớm = early") → extract EACH side as its own card, tag "vocabulary"
- Grammar keywords introduced as headers (e.g. "Sẽ", "Sắp", "Hơi") — infer English meaning from the description that follows → tag "grammar"
- Words or short phrases (≤8 words) from poem or song lyrics → tag "poem"
- Words or short phrases from dialogue or conversation sections → tag "dialogue"

SKIP:
- Example sentences illustrating grammar (arrow sentences like "Anh ấy sẽ ăn trưa...")
- English-only text, section headers, housekeeping items, exercise instructions, page numbers
- Full sentences longer than 8 Vietnamese words

Return ONLY valid JSON — no markdown, no explanation.
Format: {"pairs":[{"vietnamese":"...","english":"...","tag":"vocabulary"}]}`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text } = await req.json()
    if (!text) {
      return new Response(JSON.stringify({ error: 'Missing text field' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const MAX_CHARS = 15000
    const truncated = text.length > MAX_CHARS
    const truncatedText = truncated ? text.slice(0, MAX_CHARS) : text

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: truncatedText }],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return new Response(JSON.stringify({ error: err?.error?.message ?? res.statusText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const json = await res.json()
    const raw = json.content[0].text.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
    const parsed = JSON.parse(raw)
    // Accept both {pairs:[...]} object and bare array (fallback)
    const pairs: {vietnamese: string; english: string; tag?: string}[] =
      Array.isArray(parsed) ? parsed : (parsed.pairs ?? [])
    const suggestedTags = [...new Set(pairs.map(p => p.tag).filter(Boolean))]

    return new Response(JSON.stringify({ pairs, suggestedTags, ...(truncated && { truncated: true }) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
