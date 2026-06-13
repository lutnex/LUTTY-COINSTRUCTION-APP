import { AI_CONFIG, AI_STAGES } from '../../utils/constants.js'
import { ENV, isDirectMode, isAIConfigured } from '../../config/env.js'
import {
  formatApiError,
  readErrorBody,
  isRetryableStatus,
  isRetryableError,
  isAbortError,
} from './errors.js'
import { linkAbortSignals, canRetry, sleepBeforeRetry } from './request.js'

function logAI(level, ...args) {
  if (ENV.debug) console[level]('[AI]', ...args)
}

function buildHeaders() {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (isDirectMode()) headers.Authorization = `Bearer ${ENV.apiKey}`
  return headers
}

/** Convert stored message content to OpenAI-compatible content (string or parts array). */
export function toOpenAIContent(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return String(content ?? '')

  return content.map(part => {
    if (part.type === 'text') return { type: 'text', text: part.text ?? '' }
    if (part.type === 'image_url') {
      const url = part.image_url?.url ?? part.url
      if (!url) return { type: 'text', text: '[image attachment missing]' }
      return {
        type: 'image_url',
        image_url: {
          url,
          detail: part.image_url?.detail || 'high',
        },
      }
    }
    // Legacy Anthropic-style image blocks → OpenAI vision
    if (part.type === 'image' && part.source?.data) {
      const mime = part.source.media_type || 'image/jpeg'
      return {
        type: 'image_url',
        image_url: { url: `data:${mime};base64,${part.source.data}`, detail: 'high' },
      }
    }
    if (part.type === 'document') {
      const text = part.text || part.source?.data || ''
      return { type: 'text', text: text ? String(text).slice(0, MAX_DOC_FALLBACK) : '[document — no extractable text]' }
    }
    return { type: 'text', text: typeof part === 'string' ? part : JSON.stringify(part) }
  })
}

const MAX_DOC_FALLBACK = 24_000

/** Build OpenAI chat.completions request messages (excludes empty assistant placeholders). */
export function buildOpenAIMessages(messages, systemPrompt) {
  const out = []
  if (systemPrompt) out.push({ role: 'system', content: systemPrompt })

  for (const m of messages) {
    if (!m?.role) continue
    const content = toOpenAIContent(m.content)
    if (m.role === 'assistant' && (content === '' || content == null)) continue
    if (Array.isArray(content) && content.length === 0) continue
    out.push({ role: m.role, content })
  }
  return out
}

function summarizePayloadMessages(messages) {
  return messages.map(m => {
    const c = m.content
    if (typeof c === 'string') {
      return { role: m.role, type: 'text', chars: c.length }
    }
    if (Array.isArray(c)) {
      return {
        role: m.role,
        parts: c.map(p => {
          if (p.type === 'text') return { type: 'text', chars: (p.text || '').length }
          if (p.type === 'image_url') return { type: 'image_url', detail: p.image_url?.detail }
          return { type: p.type }
        }),
      }
    }
    return { role: m.role, type: typeof c }
  })
}

function buildRequestBody({ messages, systemPrompt, maxTokens, useStream }) {
  return {
    model: AI_CONFIG.model,
    messages: buildOpenAIMessages(messages, systemPrompt),
    max_tokens: maxTokens,
    temperature: AI_CONFIG.temperature,
    stream: useStream,
  }
}

function parseResponse(data) {
  const choice = data.choices?.[0]
  const text = choice?.message?.content ?? ''
  return {
    text: typeof text === 'string' ? text : JSON.stringify(text),
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  }
}

/**
 * callAI — OpenAI Chat Completions (streaming, retry, timeout, cancellation)
 */
export async function callAI({
  messages,
  systemPrompt,
  maxTokens = 3000,
  onChunk,
  onProgress,
  progressKey = 'chat',
  signal,
  attempt = 1,
  stream,
}) {
  if (!isAIConfigured()) {
    const msg = ENV.useProxy
      ? 'AI not configured: set OPENAI_API_KEY in .env and restart the dev server'
      : 'AI not configured: set VITE_OPENAI_API_KEY or enable proxy mode (VITE_AI_USE_PROXY=true)'
    logAI('error', msg)
    return { text: '', ok: false, error: msg, status: 0, durationMs: 0, attempt }
  }

  const t0 = Date.now()
  const stages = AI_STAGES[progressKey] || AI_STAGES.chat
  let stageIdx = 0
  const useStream = stream ?? Boolean(onChunk)

  let progressInterval
  if (onProgress) {
    onProgress(stages[0], attempt)
    progressInterval = setInterval(() => {
      stageIdx = Math.min(stageIdx + 1, stages.length - 1)
      onProgress(stages[stageIdx], attempt)
    }, 2600)
  }

  const clearProgress = () => {
    if (progressInterval) clearInterval(progressInterval)
  }

  const { signal: linkedSignal, cleanup } = linkAbortSignals(AI_CONFIG.timeoutMs, signal)

  try {
    const body = buildRequestBody({ messages, systemPrompt, maxTokens, useStream })

    logAI('log', 'request', { endpoint: AI_CONFIG.endpoint, model: AI_CONFIG.model, stream: useStream, attempt })
    if (ENV.debug || import.meta.env.DEV) {
      console.log('[Attach] final AI payload summary:', summarizePayloadMessages(body.messages))
    }

    const res = await fetch(AI_CONFIG.endpoint, {
      method: 'POST',
      headers: buildHeaders(),
      signal: linkedSignal,
      body: JSON.stringify(body),
    })

    if (isRetryableStatus(res.status) && canRetry(attempt)) {
      clearProgress()
      const errBody = await readErrorBody(res)
      const errMsg = formatApiError(res.status, errBody, 'temporary error')
      logAI('warn', 'retry status', res.status, errMsg)
      await sleepBeforeRetry(attempt, onProgress, `HTTP ${res.status}`)
      return callAI({
        messages, systemPrompt, maxTokens, onChunk, onProgress, progressKey, signal, attempt: attempt + 1, stream: useStream,
      })
    }

    if (!res.ok) {
      const errBody = await readErrorBody(res)
      const errMsg = formatApiError(res.status, errBody)
      logAI('error', 'API error', res.status, errBody)
      clearProgress()
      return { text: '', ok: false, error: errMsg, status: res.status, durationMs: Date.now() - t0, attempt }
    }

    if (useStream && res.body) {
      const result = await consumeStream(res, onChunk)
      clearProgress()
      if (!result.ok) {
        if (isRetryableError({ message: result.error }) && canRetry(attempt)) {
          await sleepBeforeRetry(attempt, onProgress, 'Stream error')
          return callAI({
            messages, systemPrompt, maxTokens, onChunk, onProgress, progressKey, signal, attempt: attempt + 1, stream: useStream,
          })
        }
        return { ...result, durationMs: Date.now() - t0, attempt }
      }
      onChunk?.(result.text, true)
      return {
        text: result.text,
        ok: true,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        durationMs: Date.now() - t0,
        attempt,
      }
    }

    const data = await res.json()
    if (data.error) {
      const errMsg = formatApiError(res.status, data)
      clearProgress()
      return { text: '', ok: false, error: errMsg, status: res.status, durationMs: Date.now() - t0, attempt }
    }

    const parsed = parseResponse(data)
    clearProgress()
    return { ...parsed, ok: true, durationMs: Date.now() - t0, attempt }
  } catch (err) {
    clearProgress()
    const userCancelled = Boolean(signal?.aborted)
    const timedOut = isAbortError(err) && !userCancelled
    const msg = userCancelled
      ? 'Request cancelled'
      : timedOut
        ? `Request timed out after ${Math.round(AI_CONFIG.timeoutMs / 1000)}s`
        : (err instanceof Error ? err.message : 'Network error — is the dev server running?')

    logAI('error', 'fetch failed', err)

    if (!userCancelled && !timedOut && isRetryableError(err) && canRetry(attempt)) {
      await sleepBeforeRetry(attempt, onProgress, 'Connection error')
      return callAI({
        messages, systemPrompt, maxTokens, onChunk, onProgress, progressKey, signal, attempt: attempt + 1, stream: useStream,
      })
    }

    if (timedOut && canRetry(attempt)) {
      await sleepBeforeRetry(attempt, onProgress, 'Timeout')
      return callAI({
        messages, systemPrompt, maxTokens, onChunk, onProgress, progressKey, signal, attempt: attempt + 1, stream: useStream,
      })
    }

    return { text: '', ok: false, error: msg, status: 0, durationMs: Date.now() - t0, attempt, aborted: userCancelled || timedOut }
  } finally {
    cleanup()
  }
}

async function consumeStream(res, onChunk) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let acc = ''
  let inTk = 0
  let outTk = 0
  let buffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const raw = trimmed.slice(5).trim()
        if (!raw || raw === '[DONE]') continue

        let ev
        try {
          ev = JSON.parse(raw)
        } catch {
          continue
        }

        if (ev.error) {
          return { ok: false, text: acc, error: formatApiError(0, ev) }
        }

        const delta = ev.choices?.[0]?.delta?.content
        if (delta) {
          acc += delta
          onChunk?.(acc, false)
        }
        if (ev.usage) {
          inTk = ev.usage.prompt_tokens ?? inTk
          outTk = ev.usage.completion_tokens ?? outTk
        }
      }
    }
  } finally {
    try { reader.releaseLock() } catch { /* ignore */ }
  }

  return { ok: true, text: acc, inputTokens: inTk, outputTokens: outTk }
}

/** Health check with latency measurement. */
export async function checkAIHealth() {
  const t0 = performance.now()
  try {
    const res = await fetch(ENV.healthUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })
    const latencyMs = Math.round(performance.now() - t0)
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return {
        ok: false,
        message: data.message || data.error?.message || `Health check HTTP ${res.status}`,
        statusLabel: data.statusLabel || data.error?.statusLabel || (res.status === 503 ? 'Missing API Key' : 'AI Offline'),
        latencyMs,
        configured: false,
        mode: data.mode,
      }
    }

    return {
      ok: Boolean(data.ok),
      message: data.status || data.message || (data.ok ? 'Ready' : 'Not configured'),
      statusLabel: data.statusLabel || (data.ok ? 'AI Connected' : 'AI Offline'),
      mode: data.mode,
      latencyMs,
      configured: Boolean(data.ok),
    }
  } catch (err) {
    const isFetch = err instanceof TypeError || /failed to fetch/i.test(err?.message || '')
    return {
      ok: false,
      message: isFetch
        ? 'Cannot reach AI server — check Vercel deployment and OPENAI_API_KEY'
        : (err instanceof Error ? err.message : 'Health check failed'),
      statusLabel: 'AI Offline',
      latencyMs: Math.round(performance.now() - t0),
      configured: false,
    }
  }
}

export function callAISync(opts) {
  return callAI({ ...opts, onChunk: undefined, stream: false })
}
