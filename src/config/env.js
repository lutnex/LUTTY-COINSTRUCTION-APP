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

const viteEnv = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {}

const useProxy = viteEnv.VITE_AI_USE_PROXY !== 'false'

export const ENV = {
  model:       viteEnv.VITE_AI_MODEL       || 'gpt-4.1-mini',
  endpoint:    useProxy ? '/api/ai-proxy' : (viteEnv.VITE_AI_ENDPOINT || 'https://api.openai.com/v1/chat/completions'),
  healthUrl:   useProxy ? '/api/ai-proxy' : (viteEnv.VITE_AI_HEALTH_URL || 'https://api.openai.com/v1/chat/completions'),
  apiKey:      viteEnv.VITE_OPENAI_API_KEY || '',
  useProxy,
  temperature: fnum(viteEnv.VITE_AI_TEMPERATURE, 0.7),
  timeoutMs:   num(viteEnv.VITE_AI_TIMEOUT_MS, 45_000),
  maxRetries:  num(viteEnv.VITE_AI_MAX_RETRIES, 3),
  debug:       viteEnv.VITE_AI_DEBUG === 'true' || viteEnv.DEV,
  supabaseUrl: viteEnv.VITE_SUPABASE_URL || '',
  supabaseAnonKey: viteEnv.VITE_SUPABASE_ANON_KEY || '',
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

export function isSupabaseConfigured() {
  const url = ENV.supabaseUrl?.trim()
  const key = ENV.supabaseAnonKey?.trim()
  if (!url || !key) return false
  if (/your-project|placeholder|xxx|changeme/i.test(url + key)) return false
  return url.startsWith('https://') && key.length > 20
}
