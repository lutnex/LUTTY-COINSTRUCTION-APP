/**
 * Shared OpenAI proxy utilities — used by Vite dev server and Vercel serverless routes.
 */

export const OPENAI_TARGET = 'https://api.openai.com'

export function isValidApiKey(key) {
  if (!key || typeof key !== 'string') return false
  const k = key.trim()
  if (k.length < 20) return false
  if (/your-key|placeholder|xxx|changeme/i.test(k)) return false
  return k.startsWith('sk-proj-') || k.startsWith('sk-')
}

export function resolveApiKey(env = process.env) {
  return env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY || ''
}

export function getHealthPayload(apiKey) {
  const valid = isValidApiKey(apiKey)
  const placeholder = apiKey && !valid

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

/** Forward a chat-completions POST to OpenAI and pipe the response (supports streaming). */
export async function proxyChatToOpenAI(req, res, apiKey) {
  try {
    const body = await readRequestBody(req)

    const upstream = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(req.headers?.accept ? { Accept: req.headers.accept } : {}),
      },
      body: body?.length ? body : undefined,
    })

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
