/**
 * Vercel serverless route: /api/ai-proxy
 * Self-contained — no external imports so Vercel bundles reliably.
 * OPENAI_API_KEY is server-side only; never exposed to the browser.
 */

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions'

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ ok: true, status: 'AI proxy active' })
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } })
    return
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    res.status(503).json({
      error: {
        message: 'OPENAI_API_KEY is not set. Add it to Vercel environment variables.',
        statusLabel: 'Missing API Key',
      },
    })
    return
  }

  try {
    const body = await readBody(req)

    const upstream = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(req.headers?.accept ? { Accept: req.headers.accept } : {}),
      },
      body: body?.length ? body : undefined,
    })

    res.status(upstream.status)
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
    res.setHeader('Cache-Control', 'no-store')

    if (upstream.body) {
      const reader = upstream.body.getReader()
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        res.write(Buffer.from(value))
      }
    }
    res.end()
  } catch (err) {
    console.error('[api/ai-proxy] OpenAI request failed:', err)
    if (!res.headersSent) {
      res.status(502).json({
        error: {
          message: err instanceof Error ? err.message : 'OpenAI proxy request failed',
          statusLabel: 'AI Offline',
        },
      })
    } else {
      res.end()
    }
  }
}
