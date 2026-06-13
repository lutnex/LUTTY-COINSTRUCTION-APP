import { useState, useEffect, useCallback, useRef } from 'react'
import { getCloudSaveStatus } from '../services/savedDocumentsService.js'

const POLL_MS = 120_000

export function useCloudSave() {
  const [status, setStatus] = useState({
    ok: null,
    configured: false,
    message: 'Checking…',
    statusLabel: 'Checking…',
    checking: true,
    lastChecked: null,
  })
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    setStatus(s => ({ ...s, checking: true }))
    const result = await getCloudSaveStatus()
    if (!mounted.current) return result

    setStatus({
      ok: result.ok,
      configured: result.configured,
      message: result.message,
      statusLabel: result.statusLabel,
      checking: false,
      lastChecked: new Date().toISOString(),
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
