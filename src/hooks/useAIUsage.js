import { useState, useCallback } from 'react'
import { loadUsageStats, recordUsage, formatCostUsd } from '../services/ai/usage.js'
import { ENV } from '../config/env.js'

export function useAIUsage() {
  const [stats, setStats] = useState(() => loadUsageStats())

  const trackRequest = useCallback(({ inputTokens = 0, outputTokens = 0 } = {}) => {
    const tokens = inputTokens + outputTokens
    if (tokens <= 0) return
    setStats(prev => recordUsage(prev, { inputTokens, outputTokens, model: ENV.model }))
  }, [])

  const reset = useCallback(() => {
    const empty = { requestCount: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0, lastRequestAt: null }
    try { localStorage.removeItem('constructiq-ai-usage') } catch { /* ignore */ }
    setStats(empty)
  }, [])

  return {
    stats,
    trackRequest,
    reset,
    requestCount: stats.requestCount,
    totalTokens: stats.totalTokens,
    estimatedCost: formatCostUsd(stats.estimatedCostUsd || 0),
  }
}
