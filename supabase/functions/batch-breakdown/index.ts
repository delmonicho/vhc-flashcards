import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Takes an array of {vietnamese, english?} and returns breakdowns for all in one Claude call.
// Output array matches input order — matched by index, not by string key.
const SYSTEM_PROMPT = `You are a Vietnamese language tutor. For each item in the input array, generate a word-by-word breakdown of the Vietnamese phrase aligned with its English meaning.

Return ONLY a valid JSON array — no markdown fences, no explanation.
The output array MUST have the same length as the input, in the same order.

Format: [{"breakdown": [{"vi": "<Vietnamese chunk>", "en": "<English chunk>"}]}]

Keep chunks to 1–3 words. Use the English translation as context to pick the right meaning for ambiguous words.`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { cards } = await req.json()
    // cards: [{vietnamese: string, english?: string}]
    if (!Array.isArray(cards) || cards.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing or empty cards array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userMessage = JSON.stringify(
      cards.map(c => ({ vi: c.vietnamese, ...(c.english ? { en: c.english } : {}) }))
    )

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
        messages: [{ role: 'user', content: userMessage }],
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

    let parsed: { breakdown: { vi: string; en: string }[] }[]
    try {
      parsed = JSON.parse(raw)
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON from model' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!Array.isArray(parsed) || parsed.length !== cards.length) {
      return new Response(JSON.stringify({ error: `Expected ${cards.length} results, got ${parsed?.length}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate and filter each breakdown
    const results = parsed.map(item => ({
      breakdown: (item.breakdown ?? []).filter(
        (chunk: { vi?: string; en?: string }) =>
          typeof chunk.vi === 'string' && chunk.vi.trim() !== '' &&
          typeof chunk.en === 'string' && chunk.en.trim() !== ''
      ),
    }))

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
