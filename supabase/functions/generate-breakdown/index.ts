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
    const { vietnamese } = await req.json()
    if (!vietnamese) {
      return new Response(JSON.stringify({ error: 'Missing vietnamese field' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const prompt =
      `You are a Vietnamese language tutor. Generate a word-by-word breakdown of the Vietnamese phrase below, aligned with its English meaning. Return ONLY a valid JSON array — no markdown fences, no explanation. Use this exact format:\n\n[{ "vi": "<Vietnamese chunk>", "en": "<English chunk>" }]\n\nKeep chunks to 1–3 words.\n\nPhrase: ${vietnamese}`

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
      return new Response(JSON.stringify({ error: err?.error?.message || res.statusText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const json = await res.json()
    const raw = json.content[0].text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const breakdown = JSON.parse(raw)

    return new Response(JSON.stringify({ breakdown }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
