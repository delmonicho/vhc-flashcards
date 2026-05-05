import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `You are a Vietnamese flashcard extractor. The user is sending a PDF of class slides. Read text AND look at images on each slide.

PRE-PROCESSING
- Identify the total number of slides (pages).
- ALWAYS skip slide 1 (title/cover) and the LAST slide (homework/closing).
- If the PDF has only 1 slide: return {"pairs": []}.
- If the PDF has only 2 slides: skip slide 1 only; process slide 2.
- If the PDF has 3+ slides: process slides 2 through N-1.

PER REMAINING SLIDE
1. Identify the slide title (the largest header text or a clearly demarcated heading at the top or bottom of the slide). Vietnamese title text is the source of truth — do not invent a title.
2. Translate the title into English and convert to kebab-case lowercase. Use this canonical mapping when the Vietnamese matches; for anything else, translate idiomatically and kebab-case it:
   | Vietnamese                | tag               |
   | ĐIỀN VÀO CHỖ TRỐNG        | fill-in-the-blank |
   | ĐẶT CÂU HỎI               | form-a-question   |
   | CUỘC HỘI THOẠI            | dialogue          |
   | MCQ / TRẮC NGHIỆM         | multiple-choice   |
   | TỪ VỰNG                   | vocabulary        |
   | NGỮ PHÁP                  | grammar           |
   | ÔN TẬP                    | review            |
   | BÀI TẬP                   | exercise          |
   | THƠ                       | poem              |
   This tag becomes the \`tag\` field on every card produced from this slide.
3. Emit the title itself as its OWN flashcard:
   { "vietnamese": "<original VN title>", "english": "<English translation>", "tag": "<kebab-tag>" }
4. Then extract every Vietnamese phrase on the slide as additional cards, all carrying the same tag.

SLIDE-TYPE RULES
- dialogue / vocabulary slides: "vn = en" or "vn : en" pairs → one card each. Antonym pairs ("trễ = late >< sớm = early") → emit BOTH sides as separate cards.
- fill-in-the-blank: read the word bank in the instruction. For EACH numbered item, choose the best word from the bank to fill the "________". The card's \`vietnamese\` is the COMPLETED sentence with the blank filled; \`english\` is your idiomatic translation.
- form-a-question (đặt câu hỏi): each numbered VN sentence is an answer; produce the corresponding question. \`vietnamese\` = the question you formed; \`english\` = its translation.
- multiple-choice (often image-only): read the question from the image, pick the correct option, and emit \`vietnamese\` = the completed/correct statement, \`english\` = its translation. One card per question.
- Skip pure-English text, page numbers, decorative footers, and the word-bank instruction line itself (only the filled sentences become cards).

OUTPUT
Return ONLY valid JSON. No markdown, no commentary.
Format: {"pairs": [{"vietnamese": "...", "english": "...", "tag": "kebab-case-tag"}]}
Every card must have a non-empty tag. If a slide has no extractable Vietnamese content beyond the title, emit just the title card.`

const MAX_PDF_BYTES = 3_145_728 // 3 MB

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { pdfBase64 } = await req.json()
    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing pdfBase64 field' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const approxBytes = Math.floor((pdfBase64.length * 3) / 4)
    if (approxBytes > MAX_PDF_BYTES) {
      return new Response(JSON.stringify({ error: 'PDF too large (max 3MB)' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 16384,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
            },
            {
              type: 'text',
              text: 'Extract flashcards from this PDF following the rules in the system prompt. Return JSON only.',
            },
          ],
        }],
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
    const pairs: { vietnamese: string; english: string; tag?: string }[] =
      Array.isArray(parsed) ? parsed : (parsed.pairs ?? [])
    const suggestedTags = [...new Set(pairs.map(p => p.tag).filter(Boolean))]
    const truncated = json.stop_reason === 'max_tokens'

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
