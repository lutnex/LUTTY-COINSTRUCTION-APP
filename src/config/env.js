/**
 * Vite-exposed environment (VITE_ prefix). Server-side OPENAI_API_KEY is injected by the proxy.
 */
const num = (v, fallback) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const fnum = (v, fallback) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export const ENV = {
  model:       import.meta.env.VITE_AI_MODEL       || 'gpt-4.1-mini',
  endpoint:    import.meta.env.VITE_AI_ENDPOINT    || '/api/ai/v1/chat/completions',
  healthUrl:   import.meta.env.VITE_AI_HEALTH_URL  || '/api/ai/health',
  apiKey:      import.meta.env.VITE_OPENAI_API_KEY || '',
  useProxy:    import.meta.env.VITE_AI_USE_PROXY !== 'false',
  temperature: fnum(import.meta.env.VITE_AI_TEMPERATURE, 0.7),
  timeoutMs:   num(import.meta.env.VITE_AI_TIMEOUT_MS, 45_000),
  maxRetries:  num(import.meta.env.VITE_AI_MAX_RETRIES, 3),
  debug:       import.meta.env.VITE_AI_DEBUG === 'true' || import.meta.env.DEV,
}

function isValidApiKey(key) {
  if (!key || typeof key !== 'string') return false
  const k = key.trim()
  if (k.length < 20) return false
  if (/your-key|placeholder|xxx|changeme/i.test(k)) return false
  return k.startsWith('sk-proj-') || k.startsWith('sk-')
}

export function isDirectMode() {
  return !ENV.useProxy && isValidApiKey(ENV.apiKey)
}

export function isAIConfigured() {
  if (ENV.useProxy) return true
  return isValidApiKey(ENV.apiKey)
}
