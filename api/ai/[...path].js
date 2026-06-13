import {
  OPENAI_TARGET,
  resolveApiKey,
  isValidApiKey,
  getMissingKeyError,
  sanitizeOpenAIError,
} from '../../lib/aiProxy.js'

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = resolveApiKey()

  if (!isValidApiKey(apiKey)) {
    res.status(503).json(getMissingKeyError(apiKey))
    return
  }

  const segments = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean)
  const subPath = '/' + segments.join('/')
  const targetUrl = `${OPENAI_TARGET}${subPath.startsWith('/') ? subPath : `/${subPath}`}`

  try {
    const body = req.method === 'POST' ? await readBody(req) : undefined

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(req.headers.accept ? { Accept: req.headers.accept } : {}),
      },
      body: body?.length ? body : undefined,
    })

    if (upstream.status === 401 || upstream.status === 403) {
      return res.status(upstream.status).json({
        error: {
          message: 'OpenAI rejected the API key. Create a new key at https://platform.openai.com/api-keys and update OPENAI_API_KEY in Vercel environment variables.',
          code: 'invalid_api_key',
          statusLabel: 'Invalid API Key',
        },
      })
    }

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
    console.error('[api/ai] proxy error:', err)
    if (!res.headersSent) {
      res.status(502).json({
        error: {
          message: sanitizeOpenAIError({ message: err instanceof Error ? err.message : 'OpenAI proxy request failed' }),
          statusLabel: 'AI Offline',
        },
      })
    } else {
      res.end()
    }
  }
}
