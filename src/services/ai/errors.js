/** Shared API error parsing and user-facing messages. */

const FRIENDLY = {
  401: 'Authentication failed — check your API key in .env and restart the dev server.',
  403: 'Access denied — your API key may lack permission for this model.',
  404: 'AI endpoint not found — verify VITE_AI_ENDPOINT and proxy configuration.',
  429: 'Rate limit reached — the request will retry automatically, or wait a moment.',
  500: 'OpenAI server error — temporary issue, retrying…',
  502: 'Bad gateway — upstream AI service unavailable.',
  503: 'AI service unavailable — check OPENAI_API_KEY and restart.',
  529: 'API overloaded — retrying with backoff…',
}

export function parseApiErrorBody(body) {
  if (!body) return null
  if (body?.error?.message) {
    const code = body.error.code || body.error.type
    return code ? `[${code}] ${body.error.message}` : body.error.message
  }
  if (typeof body?.message === 'string') return body.message
  return null
}

export function formatApiError(status, body, fallback = 'Unknown API error') {
  const parsed = parseApiErrorBody(body)
  if (parsed) return parsed
  if (status) return `HTTP ${status}${fallback ? `: ${fallback}` : ''}`
  return fallback
}

export async function readErrorBody(res) {
  const text = await res.text().catch(() => '')
  try {
    return JSON.parse(text)
  } catch {
    return { error: { message: text.slice(0, 500) || res.statusText } }
  }
}

export function isRetryableStatus(status) {
  return [408, 429, 500, 502, 503, 504, 529].includes(status)
}

export function isRetryableError(err, status = 0) {
  if (status && isRetryableStatus(status)) return true
  const msg = String(err?.message || err || '').toLowerCase()
  return (
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('econnreset') ||
    msg.includes('socket') ||
    msg.includes('timed out') ||
    msg.includes('timeout')
  )
}

export function isAbortError(err) {
  return err?.name === 'AbortError' || String(err?.message || '').toLowerCase().includes('abort')
}

/** Map raw API / network errors to short UI-friendly titles + detail. */
export function toUserFacingError({ error, status, durationMs } = {}) {
  const raw = error || 'Request failed'
  const title = status
    ? `AI request failed (HTTP ${status})`
    : raw.toLowerCase().includes('timeout')
      ? 'Request timed out'
      : raw.toLowerCase().includes('not configured')
        ? 'AI not configured'
        : 'AI request failed'

  let detail = raw
  if (status && FRIENDLY[status]) {
    detail = `${FRIENDLY[status]}\n\n${raw}`
  } else if (raw.toLowerCase().includes('failed to fetch')) {
    detail = 'Cannot reach the AI server. Is `npm run dev` running? Check your network and proxy settings.'
  }

  return {
    title,
    detail,
    status: status || 0,
    durationMs: durationMs ?? 0,
    retryable: isRetryableStatus(status) || isRetryableError({ message: raw }, status),
  }
}
