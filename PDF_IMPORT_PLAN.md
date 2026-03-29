# Plan: PDF Import Feature

## Context

Users bring Vietnamese class lecture PDFs to each study session. Currently every flashcard must be typed in one by one via VocabInput. The PDFs contain vocabulary lists in "Vietnamese = English" format, dialogue vocab, and exercise phrases — exactly the content that should become flashcards. This feature auto-extracts those pairs from a PDF upload and lets the user review + bulk-import them into a week's deck.

---

## Approach

Three-step pipeline:

1. **Upload & extract** — client sends PDF as base64 JSON to `/api/pdf-extract.js` → `pdf-parse` returns raw text
2. **Parse vocab** — client sends text to `/api/pdf-parse-vocab.js` → Claude returns `[{vietnamese, english}]` pairs
3. **Review & import** — `PdfImportModal` lets user deselect cards and assign categories, then bulk-inserts into Supabase and queues breakdowns

No new npm package for multipart (avoiding busboy complexity). Instead, base64-encode PDF on the client, send as JSON. Enforce a 3MB client-side file size limit so the base64 payload stays well under Vercel's 4.5MB JSON body limit.

---

## Files

### New files
| File | Purpose |
|------|---------|
| `api/pdf-extract.js` | Receives `{ pdf: base64 }`, runs `pdf-parse`, returns `{ text }` |
| `api/pdf-parse-vocab.js` | Receives `{ text }`, calls Claude, returns `{ pairs: [{vietnamese, english}], truncated? }` |
| `src/components/PdfImportModal.jsx` | 5-phase modal: uploading → extracting → review → importing → done |
| `src/lib/pdfImport.js` | Thin fetch helpers: `extractPdfText(file)` and `parseVocabPairs(text)` |

### Modified files
| File | Change |
|------|--------|
| `src/pages/Week.jsx` | Add `showPdfImport` state, import trigger button, `handlePdfImport()` callback, modal mount |
| `package.json` | Add `"pdf-parse": "^1.1.1"` to dependencies |
| `CLAUDE.md` | Document new API endpoints |
| `src/components/CLAUDE.md` | Document PdfImportModal |
| `src/lib/CLAUDE.md` | Document pdfImport.js |

---

## Implementation Details

### `api/pdf-extract.js`
```js
import pdfParse from 'pdf-parse/lib/pdf-parse.js'  // direct subpath import avoids test file issue

export default async function handler(req, res) {
  // CORS headers (match existing api files)
  const { pdf } = req.body   // base64 string
  const buffer = Buffer.from(pdf, 'base64')
  const { text } = await pdfParse(buffer)
  return res.status(200).json({ text })
}
```
- Rejects if `buffer.length > 3_145_728` (3MB) with 413
- Try/catch returns `{ error }` on parse failure

### `api/pdf-parse-vocab.js`
Calls Anthropic API directly (same pattern as `api/claude.js`). System prompt is baked in server-side — never exposed to client.

**System prompt:**
```
You are a Vietnamese language assistant extracting flashcard vocabulary from class materials.

EXTRACT: lines pairing Vietnamese with English using = or :, vocabulary list items, short
Vietnamese phrases (≤8 words) from dialogue sections where meaning is clear from context.

SKIP: classical/archaic Vietnamese poetry (headers like ĐỌC THÀNH TIẾNG, THƠ, or archaic
vocabulary), grammar formulas (S+V+O patterns), section headers, English-only text,
full sentences longer than 8 words, page numbers.

Return ONLY a JSON array. No markdown. No explanation.
Format: [{"vietnamese":"...","english":"..."}]
```

- Truncates text to 15,000 chars before sending; returns `truncated: true` if so
- Strips markdown fences before `JSON.parse` (Claude sometimes wraps output)
- `max_tokens: 4096`, model: `claude-haiku-4-5-20251001` (faster/cheaper for extraction)

### `src/lib/pdfImport.js`
```js
export async function extractPdfText(file) { ... }   // FileReader → base64 → POST /api/pdf-extract
export async function parseVocabPairs(text) { ... }  // POST /api/pdf-parse-vocab → { pairs, truncated }
```

### `PdfImportModal` state machine
```
'uploading'   → file selected, both API calls in flight (extract + parse)
'review'      → pairs received, user reviews list
'importing'   → sequential Supabase inserts with live counter
'done'        → summary shown
'error'       → any failure, retry resets to 'uploading'
```

**Review phase UI:**
- Header: "Found N vocabulary pairs" (+ truncation warning if applicable)
- Bulk category pill selector at top (defaults to `['class']` if that category exists, else empty)
- Scrollable list: checkbox | editable Vietnamese | editable English per row
- Select All / Deselect All link
- Footer: "Import N cards" primary button + Cancel

**Bulk insert loop** (sequential for progress tracking, gracefully skips individual failures):
```js
for (const pair of selected) {
  setImportedCount(i++)
  const { data } = await supabase.from('flashcards').insert({...}).select().single()
  if (data) results.push(data)
}
```

### Week.jsx additions
```jsx
// State
const [showPdfImport, setShowPdfImport] = useState(false)

// Callback — prepends new cards, queues breakdowns (mirrors VocabInput's onCardCreated path)
function handlePdfImport(newCards) {
  setCards(prev => [...newCards, ...prev])
  setShowPdfImport(false)
  newCards.forEach(card =>
    getOrCreateBreakdown(card.vietnamese, card.id, card.english)
      .then(bd => handleBreakdownReady(card.id, bd))
      .catch(err => logError('pdf import breakdown failed', { page: 'week', action: 'breakdown', err }))
  )
}

// Trigger button — placed directly below <VocabInput>, full-width dashed secondary style
<button
  onClick={() => setShowPdfImport(true)}
  className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-co-border dark:border-gray-700 text-sm font-semibold text-co-muted dark:text-gray-400 hover:border-co-primary hover:text-co-primary dark:hover:text-co-primary transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2"
  aria-label="Import flashcards from PDF"
>
  ↑ Import from PDF
</button>

// Conditional render (only for deck owners)
{showPdfImport && isOwner && (
  <PdfImportModal weekId={weekId} categories={categories} onCategoriesChange={onCategoriesChange} onCardsImported={handlePdfImport} onClose={() => setShowPdfImport(false)} />
)}
```

---

## Key Gotchas

- **`pdf-parse` import path**: Use `import pdfParse from 'pdf-parse/lib/pdf-parse.js'` — the package's top-level entry point tries to load test fixtures that don't exist in Vercel's serverless environment
- **ESM + CJS interop**: `package.json` has `"type": "module"`. `pdf-parse` is CJS but Node.js ESM can import CJS modules directly
- **`handleBreakdownReady` must be used**: Per `src/pages/CLAUDE.md`, any new card creation path must call `handleBreakdownReady(cardId, breakdown)`, not just update state directly
- **Only show import button for `isOwner`**: Public deck viewers should not be able to add cards
- **`source` column is `text[]` (array)**: Same as VocabInput — pass selected category IDs as array

---

## Verification

1. Run `npm install` to add `pdf-parse`
2. `vercel dev` locally, upload the sample PDF `/Users/delmo/Downloads/VHC Adult 102 Week 4 Spring 2026.pdf`
3. Confirm `/api/pdf-extract` returns text containing "thức khuya = stay up late"
4. Confirm `/api/pdf-parse-vocab` returns pairs array with ~30–50 items, classical poetry excluded
5. In the app: open a week, click "Import from PDF", upload PDF, verify review modal shows pairs
6. Import a subset, verify cards appear in the week deck (newest-first)
7. Wait ~5s, verify breakdown chips appear on imported cards
8. Confirm import button is hidden when viewing a public deck (non-owner)
