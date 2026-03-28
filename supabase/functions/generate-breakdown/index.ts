import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { vietnamese, english } = await req.json()
    if (!vietnamese) {
      return new Response(JSON.stringify({ error: 'Missing vietnamese field' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const contextLine = english ? `\nEnglish translation: ${english}` : ''
    const prompt =
      `You are a Vietnamese language tutor. Generate a word-by-word breakdown of the Vietnamese phrase below, aligned with its English meaning. Return ONLY a valid JSON array — no markdown fences, no explanation. Use this exact format:\n\n[{ "vi": "<Vietnamese chunk>", "en": "<English chunk>" }]\n\nKeep chunks to 1–3 words. Use the English translation as context to pick the right meaning for ambiguous words.${contextLine}\n\nPhrase: ${vietnamese}`

    let lastError = ''
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        lastError = err?.error?.message || res.statusText
        continue
      }

      const json = await res.json()
      const raw = json.content[0].text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
      let parsed
      try {
        parsed = JSON.parse(raw)
      } catch {
        lastError = `Invalid JSON on attempt ${attempt}`
        continue
      }

      const breakdown = parsed.filter(
        (chunk: { vi?: string; en?: string }) =>
          typeof chunk.vi === 'string' && chunk.vi.trim() !== '' &&
          typeof chunk.en === 'string' && chunk.en.trim() !== ''
      )

      if (breakdown.length === 0) {
        lastError = `No chunks with both vi and en values on attempt ${attempt}`
        continue
      }

      return new Response(JSON.stringify({ breakdown }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: `Breakdown generation failed after 3 attempts: ${lastError}` }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
