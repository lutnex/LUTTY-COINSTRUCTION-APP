import { AI_CONFIG } from '../../utils/constants.js'

const delay = (ms) => new Promise(r => setTimeout(r, ms))

/** Exponential backoff with jitter; capped at 30s. */
export function getRetryDelayMs(attempt, baseMs = 1200) {
  const exp = baseMs * Math.pow(2, Math.max(0, attempt - 1))
  const jitter = Math.random() * 0.25 * exp
  return Math.min(Math.round(exp + jitter), 30_000)
}

export function canRetry(attempt, maxRetries = AI_CONFIG.maxRetries) {
  return attempt < maxRetries
}

export async function sleepBeforeRetry(attempt, onProgress, reason) {
  const wait = getRetryDelayMs(attempt)
  onProgress?.(`${reason} — retry ${attempt}/${AI_CONFIG.maxRetries}…`, attempt)
  await delay(wait)
}

/** Merge external AbortSignal with timeout AbortController. */
export function linkAbortSignals(timeoutMs, externalSignal) {
  const ac = new AbortController()
  const timeoutId = setTimeout(() => ac.abort(), timeoutMs)

  const onExternalAbort = () => ac.abort()
  if (externalSignal) {
    if (externalSignal.aborted) ac.abort()
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true })
  }

  const cleanup = () => {
    clearTimeout(timeoutId)
    externalSignal?.removeEventListener('abort', onExternalAbort)
  }

  return { signal: ac.signal, cleanup, abort: () => ac.abort() }
}

/** In-flight request guard — prevents duplicate submissions. */
export function createRequestGuard() {
  let active = false
  let requestId = 0

  return {
    tryAcquire() {
      if (active) return null
      active = true
      requestId += 1
      return requestId
    },
    release(id) {
      if (id === requestId) active = false
    },
    isActive: () => active,
    get currentId() { return requestId },
  }
}
