/**
 * Vercel serverless route: /api/ai-proxy
 * OPENAI_API_KEY stays server-side only — never sent to the browser.
 */

import {
  resolveApiKey,
  isValidApiKey,
  getMissingKeyError,
  checkOpenAIHealth,
  sanitizeOpenAIError,
} from '../lib/aiProxy.js'

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
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'GET' || req.method === 'HEAD') {
    const health = await checkOpenAIHealth()
    return res.status(health.ok ? 200 : 503).json(health)
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  const apiKey = resolveApiKey()
  if (!isValidApiKey(apiKey)) {
    return res.status(503).json(getMissingKeyError(apiKey))
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
          message: sanitizeOpenAIError({ message: err instanceof Error ? err.message : 'OpenAI proxy request failed' }),
          statusLabel: 'AI Offline',
        },
      })
    }
    res.end()
  }
}
