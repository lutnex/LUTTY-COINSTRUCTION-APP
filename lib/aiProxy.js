/**
 * Shared OpenAI proxy utilities — used by Vite dev server and Vercel serverless routes.
 */

export const OPENAI_TARGET = 'https://api.openai.com'

export function normalizeApiKey(key) {
  if (!key || typeof key !== 'string') return ''
  return key.trim().replace(/^['"]|['"]$/g, '').replace(/\r?\n/g, '')
}

export function isValidApiKey(key) {
  const k = normalizeApiKey(key)
  if (!k) return false
  if (k.length < 20) return false
  if (/your-key|placeholder|xxx|changeme/i.test(k)) return false
  return k.startsWith('sk-proj-') || k.startsWith('sk-')
}

export function resolveApiKey(env = process.env) {
  return normalizeApiKey(env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY || '')
}

export function sanitizeOpenAIError(body) {
  const message = body?.error?.message || body?.message || ''
  if (!message) return 'OpenAI request failed'
  if (/incorrect api key|invalid_api_key|invalid api key/i.test(message)) {
    return 'OpenAI rejected the API key. Create a new key at https://platform.openai.com/api-keys and update OPENAI_API_KEY in Vercel environment variables.'
  }
  return message.replace(/sk-(?:proj-)?[A-Za-z0-9_-]+/g, 'sk-***')
}

export function getHealthPayload(apiKey) {
  const normalized = normalizeApiKey(apiKey)
  const valid = isValidApiKey(normalized)
  const placeholder = normalized && !valid

  let message
  let statusLabel

  if (valid) {
    message = 'OpenAI API key configured'
    statusLabel = 'AI Connected'
  } else if (placeholder) {
    message = 'OPENAI_API_KEY looks like a placeholder — replace with your real key'
    statusLabel = 'Invalid API Key'
  } else {
    message = 'OPENAI_API_KEY is missing — set it in Vercel environment variables'
    statusLabel = 'Missing API Key'
  }

  return {
    ok: valid,
    mode: 'openai-proxy',
    message,
    statusLabel,
    configured: valid,
  }
}

export async function verifyOpenAIKey(apiKey) {
  const key = normalizeApiKey(apiKey)
  if (!isValidApiKey(key)) {
    return { ok: false, status: 0, message: 'API key is missing or malformed' }
  }

  try {
    const res = await fetch(`${OPENAI_TARGET}/v1/models?limit=1`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(12_000),
    })

    if (res.ok) return { ok: true, status: res.status }

    const body = await res.json().catch(() => null)
    return {
      ok: false,
      status: res.status,
      message: sanitizeOpenAIError(body),
      code: body?.error?.code || body?.error?.type || null,
    }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : 'OpenAI verification failed',
    }
  }
}

export async function checkOpenAIHealth(env = process.env) {
  const apiKey = resolveApiKey(env)
  const base = getHealthPayload(apiKey)
  if (!base.ok) return base

  const verified = await verifyOpenAIKey(apiKey)
  if (verified.ok) {
    return { ...base, message: 'OpenAI API key verified', verified: true }
  }

  return {
    ok: false,
    mode: 'openai-proxy',
    configured: true,
    verified: false,
    message: verified.message || 'OpenAI key verification failed',
    statusLabel: verified.status === 401 || verified.code === 'invalid_api_key'
      ? 'Invalid API Key'
      : 'AI Offline',
  }
}

export function getMissingKeyError(apiKey) {
  return {
    error: {
      message: apiKey
        ? 'OPENAI_API_KEY is a placeholder. Add your real key and redeploy.'
        : 'OPENAI_API_KEY is not set. Add it to Vercel environment variables.',
      statusLabel: apiKey ? 'Invalid API Key' : 'Missing API Key',
    },
  }
}

export const OPENAI_CHAT_URL = `${OPENAI_TARGET}/v1/chat/completions`

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function writeSanitizedAuthError(res, status = 401) {
  const payload = {
    error: {
      message: 'OpenAI rejected the API key. Create a new key at https://platform.openai.com/api-keys and update OPENAI_API_KEY in Vercel environment variables.',
      code: 'invalid_api_key',
      statusLabel: 'Invalid API Key',
    },
  }
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(payload))
}

/** Forward a chat-completions POST to OpenAI and pipe the response (supports streaming). */
export async function proxyChatToOpenAI(req, res, apiKey) {
  const key = normalizeApiKey(apiKey)
  try {
    const body = await readRequestBody(req)

    const upstream = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        ...(req.headers?.accept ? { Accept: req.headers.accept } : {}),
      },
      body: body?.length ? body : undefined,
    })

    if (upstream.status === 401 || upstream.status === 403) {
      await writeSanitizedAuthError(res, upstream.status)
      return
    }

    res.statusCode = upstream.status
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
    console.error('[ai-proxy] OpenAI request failed:', err)
    if (!res.headersSent) {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({
        error: {
          message: err instanceof Error ? err.message : 'OpenAI proxy request failed',
          statusLabel: 'AI Offline',
        },
      }))
    } else {
      res.end()
    }
  }
}
