import { useCallback, useEffect, useRef } from 'react'
import {
  buildWorkspaceSnapshot,
  saveWorkspaceSnapshot,
  loadWorkspaceSnapshot,
  applyWorkspaceSnapshotToStorage,
  clearBrokenWorkspaceData,
} from '../utils/workspaceSession.js'
import { saveChatSession } from '../utils/sessionStore.js'
import { logSessionDebug } from '../utils/sessionDebug.js'

const AUTO_SAVE_MS = 4000

/**
 * Auto-save workspace + manual restore controls.
 */
export function useWorkspaceSession({
  tab,
  chatMsgs,
  intelligenceData,
  workflowState,
  extractedPrices,
  activeProjectId,
  estimatePreferences,
  priceProfileActiveId,
  onRestoreUiState,
  toast,
}) {
  const saveNow = useCallback(() => {
    const snapshot = buildWorkspaceSnapshot({
      tab,
      chatMsgs,
      intelligenceData,
      workflowState,
      extractedPrices,
      activeProjectId,
      estimatePreferences,
      priceProfileActiveId,
    })
    saveWorkspaceSnapshot(snapshot)
    saveChatSession(chatMsgs)
    return snapshot
  }, [
    tab, chatMsgs, intelligenceData, workflowState, extractedPrices,
    activeProjectId, estimatePreferences, priceProfileActiveId,
  ])

  const restoreLastSession = useCallback((options = {}) => {
    const snap = loadWorkspaceSnapshot()
    if (!snap) {
      toast?.warn?.('Nothing to restore', 'No saved workspace snapshot found')
      logSessionDebug('restore-skipped', { reason: 'no-snapshot' })
      return false
    }
    const result = applyWorkspaceSnapshotToStorage(snap)
    if (!result.ok) {
      toast?.error?.('Restore failed', result.error || 'Could not read saved session')
      return false
    }
    if (options.reload !== false) {
      window.location.reload()
      return true
    }
    onRestoreUiState?.(snap)
    toast?.success?.('Last session restored', 'Your workspace was loaded from the latest snapshot')
    logSessionDebug('restored-in-place', { msgs: snap.chat?.length ?? 0 })
    return true
  }, [onRestoreUiState, toast])

  const clearBrokenSession = useCallback(() => {
    clearBrokenWorkspaceData()
    toast?.info?.('Broken data cleared', 'Chat backup kept — reload to continue')
    logSessionDebug('clear-broken-invoked')
    window.location.reload()
  }, [toast])

  useEffect(() => {
    const id = setInterval(saveNow, AUTO_SAVE_MS)
    return () => clearInterval(id)
  }, [saveNow])

  useEffect(() => {
    const onUnload = () => saveNow()
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [saveNow])

  const bootRestored = useRef(false)
  useEffect(() => {
    if (bootRestored.current) return
    bootRestored.current = true

    const snap = loadWorkspaceSnapshot()
    if (!snap) return

    const hasSnapChat = Array.isArray(snap.chat) && snap.chat.length > 0
    const hasLiveChat = Array.isArray(chatMsgs) && chatMsgs.length > 0
    const needsChatRestore = hasSnapChat && !hasLiveChat

    if (needsChatRestore) {
      applyWorkspaceSnapshotToStorage(snap)
      logSessionDebug('boot-restore-reload', { reason: 'empty-chat', msgs: snap.chat.length })
      toast?.info?.('Last session restored', 'Reloading your chat and workspace…')
      window.location.reload()
      return
    }

    if (hasSnapChat || snap.intelligence?.boqItems?.length) {
      logSessionDebug('boot-session-detected', {
        msgs: snap.chat?.length ?? 0,
        boq: snap.intelligence?.boqItems?.length ?? 0,
      })
      if (!sessionStorage.getItem('constructiq-session-restored')) {
        sessionStorage.setItem('constructiq-session-restored', '1')
        toast?.info?.('Last session restored', 'Your chat and workspace were loaded automatically')
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.__constructiqSaveSession = saveNow
    window.__constructiqRestoreSession = () => restoreLastSession({ reload: true })
    window.__constructiqClearBrokenSession = clearBrokenSession
    window.__constructiqGoDashboard = () => {
      try {
        localStorage.setItem('constructiq-app-session', JSON.stringify({
          version: 1,
          savedAt: new Date().toISOString(),
          tab: 'chat',
        }))
      } catch { /* ignore */ }
      window.location.assign(`${window.location.origin}${window.location.pathname}`)
    }
    return () => {
      delete window.__constructiqSaveSession
      delete window.__constructiqRestoreSession
      delete window.__constructiqClearBrokenSession
      delete window.__constructiqGoDashboard
    }
  }, [saveNow, restoreLastSession, clearBrokenSession])

  return { saveNow, restoreLastSession, clearBrokenSession }
}
