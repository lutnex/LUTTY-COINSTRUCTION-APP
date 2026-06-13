import { ENV } from '../../config/env.js'

const STORAGE_KEY = 'constructiq-ai-usage'

/** USD per 1M tokens — override via env for other models. */
const DEFAULT_PRICING = {
  'gpt-4.1-mini': { input: 0.40, output: 1.60 },
  'gpt-4.1':      { input: 2.00, output: 8.00 },
  'gpt-4o-mini':  { input: 0.15, output: 0.60 },
  'gpt-4o':       { input: 2.50, output: 10.00 },
}

function getPricing(model) {
  const key = model || ENV.model
  return DEFAULT_PRICING[key] || DEFAULT_PRICING['gpt-4.1-mini']
}

export function estimateTokenCost(inputTokens = 0, outputTokens = 0, model) {
  const p = getPricing(model)
  const inputCost  = (inputTokens / 1_000_000) * p.input
  const outputCost = (outputTokens / 1_000_000) * p.output
  return inputCost + outputCost
}

export function loadUsageStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStats()
    const data = JSON.parse(raw)
    return { ...emptyStats(), ...data }
  } catch {
    return emptyStats()
  }
}

export function emptyStats() {
  return {
    requestCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    lastRequestAt: null,
  }
}

export function recordUsage(prev, { inputTokens = 0, outputTokens = 0, model } = {}) {
  const inp = inputTokens || 0
  const out = outputTokens || 0
  const addCost = estimateTokenCost(inp, out, model)
  const next = {
    requestCount: (prev.requestCount || 0) + 1,
    inputTokens: (prev.inputTokens || 0) + inp,
    outputTokens: (prev.outputTokens || 0) + out,
    totalTokens: (prev.totalTokens || 0) + inp + out,
    estimatedCostUsd: (prev.estimatedCostUsd || 0) + addCost,
    lastRequestAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch { /* quota */ }
  return next
}

export function formatCostUsd(usd) {
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}
