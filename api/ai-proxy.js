/**
 * Vercel serverless route: POST /api/ai-proxy
 * Self-contained (no external imports) so Vercel bundles it reliably.
 * OPENAI_API_KEY is read server-side only — never exposed to the browser.
 */

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions'

function isValidApiKey(key) {
  if (!key || typeof key !== 'string') return false
  const k = key.trim()
  if (k.length < 20) return false
  if (/your-key|placeholder|xxx|changeme/i.test(k)) return false
  return k.startsWith('sk-proj-') || k.startsWith('sk-')
}

function resolveApiKey() {
  return process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || ''
}

function getHealthPayload(apiKey) {
  const valid = isValidApiKey(apiKey)
  const placeholder = apiKey && !valid
  return {
    ok: valid,
    mode: 'openai-proxy',
    message: valid
      ? 'OpenAI API key configured'
      : placeholder
        ? 'OPENAI_API_KEY looks like a placeholder — replace with your real key'
        : 'OPENAI_API_KEY is missing — set it in Vercel environment variables',
    statusLabel: valid ? 'AI Connected' : placeholder ? 'Invalid API Key' : 'Missing API Key',
    configured: valid,
  }
}

function getMissingKeyError(apiKey) {
  return {
    error: {
      message: apiKey
        ? 'OPENAI_API_KEY is a placeholder. Add your real key and redeploy.'
        : 'OPENAI_API_KEY is not set. Add it to Vercel environment variables.',
      statusLabel: apiKey ? 'Invalid API Key' : 'Missing API Key',
    },
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function proxyToOpenAI(req, res, apiKey) {
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

export default async function handler(req, res) {
  // GET / HEAD → health check (used by useAIHealth)
  if (req.method === 'GET' || req.method === 'HEAD') {
    const payload = getHealthPayload(resolveApiKey())
    res.setHeader('Cache-Control', 'no-store')
    res.status(payload.ok ? 200 : 503).json(payload)
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } })
    return
  }

  const apiKey = resolveApiKey()
  if (!isValidApiKey(apiKey)) {
    res.status(503).json(getMissingKeyError(apiKey))
    return
  }

  await proxyToOpenAI(req, res, apiKey)
}
