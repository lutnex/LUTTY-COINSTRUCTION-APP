/**
 * Vercel serverless route: /api/ai-proxy
 * OPENAI_API_KEY stays server-side only — never sent to the browser.
 */

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions'

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function getRequestBody(req) {
  const body = req.body

  if (body != null && body !== '') {
    if (Buffer.isBuffer(body)) return body
    if (typeof body === 'string') return Buffer.from(body)
    if (typeof body === 'object') return Buffer.from(JSON.stringify(body))
  }

  const raw = await readRawBody(req)
  return raw.length ? raw : null
}

async function pipeUpstreamResponse(upstream, res) {
  res.status(upstream.status)
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
  res.setHeader('Cache-Control', 'no-store')

  if (!upstream.body) {
    res.end()
    return
  }

  const reader = upstream.body.getReader()
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    res.write(Buffer.from(value))
  }
  res.end()
}

export default async function handler(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ ok: true, status: 'AI proxy active' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(503).json({
      error: {
        message: 'OPENAI_API_KEY is not set. Add it to Vercel environment variables.',
        statusLabel: 'Missing API Key',
      },
    })
  }

  try {
    const body = await getRequestBody(req)

    const upstream = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(req.headers?.accept ? { Accept: req.headers.accept } : {}),
      },
      body: body ?? undefined,
    })

    await pipeUpstreamResponse(upstream, res)
  } catch (err) {
    console.error('[api/ai-proxy] OpenAI request failed:', err)
    if (!res.headersSent) {
      return res.status(502).json({
        error: {
          message: err instanceof Error ? err.message : 'OpenAI proxy request failed',
          statusLabel: 'AI Offline',
        },
      })
    }
    res.end()
  }
}
