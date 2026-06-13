import { useState, useEffect, useCallback, useRef } from 'react'
import { checkAIHealth } from '../services/ai/client.js'

const POLL_MS = 60_000

export function useAIHealth() {
  const [status, setStatus] = useState({
    ok: null,
    message: 'Checking…',
    checking: true,
    latencyMs: null,
    mode: null,
    lastChecked: null,
  })
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    setStatus(s => ({ ...s, checking: true }))
    const result = await checkAIHealth()
    if (!mounted.current) return result

    setStatus({
      ok: result.ok,
      message: result.message,
      mode: result.mode,
      latencyMs: result.latencyMs,
      checking: false,
      lastChecked: new Date().toISOString(),
      configured: result.configured,
    })
    return result
  }, [])

  useEffect(() => {
    mounted.current = true
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => {
      mounted.current = false
      clearInterval(id)
    }
  }, [refresh])

  return { ...status, refresh }
}
