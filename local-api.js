// Local dev server for Vercel API functions — used by `npm run dev`
// Proxied from Vite via /api/* → http://localhost:3001
import http from 'http'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { pathToFileURL } from 'url'

// Load .env.local into process.env
try {
  for (const line of readFileSync('.env.local', 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch { /* no .env.local, fall through to existing env */ }

const PORT = 3001
const cache = new Map()

async function loadHandler(name) {
  if (!cache.has(name)) {
    const url = pathToFileURL(resolve(`api/${name}.js`)).href
    const { default: fn } = await import(url)
    cache.set(name, fn)
  }
  return cache.get(name)
}

http.createServer(async (req, res) => {
  const name = req.url?.split('?')[0].match(/^\/api\/(.+)$/)?.[1]
  if (!name) { res.writeHead(404); res.end('Not found'); return }

  const chunks = []
  req.on('data', c => chunks.push(c))
  req.on('end', async () => {
    try { req.body = JSON.parse(Buffer.concat(chunks).toString() || '{}') }
    catch { req.body = {} }

    res.status = code => { res.statusCode = code; return res }
    res.json = data => {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(data))
      return res
    }

    try {
      const handler = await loadHandler(name)
      await handler(req, res)
    } catch (err) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: err.message }))
    }
  })
}).listen(PORT, () => console.log(`  \x1b[36m➜\x1b[0m  API:     http://localhost:${PORT}/api`))
