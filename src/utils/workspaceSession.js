/**
 * Unified workspace snapshot — chat, intelligence, workflow, and UI state.
 */

import { CHAT_STORAGE_KEY, SESSION_STORAGE_KEY, serializeChatMessages } from './sessionStore.js'
import { INTELLIGENCE_STORAGE_KEY } from './projectIntelligence.js'
import { WORKFLOW_SESSION_KEY } from './workflowActions.js'
import { logSessionDebug } from './sessionDebug.js'

export const WORKSPACE_SNAPSHOT_KEY = 'constructiq-workspace-snapshot'
export const WORKSPACE_SNAPSHOT_VERSION = 2

export function buildWorkspaceSnapshot({
  tab = 'chat',
  chatMsgs = [],
  intelligenceData = null,
  workflowState = {},
  extractedPrices = [],
  activeProjectId = null,
  estimatePreferences = null,
  priceProfileActiveId = null,
} = {}) {
  return {
    version: WORKSPACE_SNAPSHOT_VERSION,
    savedAt: new Date().toISOString(),
    tab,
    chat: serializeChatMessages(chatMsgs),
    intelligence: intelligenceData,
    workflowState,
    extractedPrices: Array.isArray(extractedPrices) ? extractedPrices : [],
    activeProjectId,
    estimatePreferences,
    priceProfileActiveId,
  }
}

export function saveWorkspaceSnapshot(snapshot) {
  try {
    localStorage.setItem(WORKSPACE_SNAPSHOT_KEY, JSON.stringify(snapshot))
    logSessionDebug('snapshot-saved', {
      msgs: snapshot?.chat?.length ?? 0,
      boqItems: snapshot?.intelligence?.boqItems?.length ?? 0,
      tab: snapshot?.tab,
    })
    return true
  } catch (e) {
    console.error('[workspaceSession] save failed', e)
    return false
  }
}

export function loadWorkspaceSnapshot() {
  try {
    const raw = localStorage.getItem(WORKSPACE_SNAPSHOT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch (e) {
    console.error('[workspaceSession] load failed', e)
    return null
  }
}

/** Restore chat + intelligence + workflow from snapshot into live stores. */
export function applyWorkspaceSnapshotToStorage(snapshot) {
  if (!snapshot) return { ok: false, error: 'No snapshot' }
  try {
    if (Array.isArray(snapshot.chat) && snapshot.chat.length) {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({
        version: 1,
        savedAt: snapshot.savedAt || new Date().toISOString(),
        msgs: snapshot.chat,
      }))
    }
    if (snapshot.intelligence && typeof snapshot.intelligence === 'object') {
      localStorage.setItem(INTELLIGENCE_STORAGE_KEY, JSON.stringify(snapshot.intelligence))
    }
    if (snapshot.workflowState && typeof snapshot.workflowState === 'object') {
      localStorage.setItem(WORKFLOW_SESSION_KEY, JSON.stringify({
        version: 1,
        savedAt: snapshot.savedAt || new Date().toISOString(),
        ...snapshot.workflowState,
      }))
    }
    if (snapshot.tab) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        version: 1,
        savedAt: snapshot.savedAt || new Date().toISOString(),
        tab: snapshot.tab,
        activeProjectId: snapshot.activeProjectId ?? null,
        extractedPrices: snapshot.extractedPrices ?? [],
        estimatePreferences: snapshot.estimatePreferences ?? null,
        priceProfileActiveId: snapshot.priceProfileActiveId ?? null,
      }))
    }
    logSessionDebug('snapshot-applied-to-storage', { msgs: snapshot.chat?.length ?? 0 })
    return { ok: true }
  } catch (e) {
    console.error('[workspaceSession] apply failed', e)
    return { ok: false, error: e?.message }
  }
}

/** Clear corrupted workflow/intelligence keys but keep chat snapshot backup. */
export function clearBrokenWorkspaceData() {
  const snap = loadWorkspaceSnapshot()
  try {
    localStorage.removeItem(INTELLIGENCE_STORAGE_KEY)
    localStorage.removeItem(WORKFLOW_SESSION_KEY)
    if (snap?.chat?.length) {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        msgs: snap.chat,
      }))
    }
    logSessionDebug('broken-session-cleared', { keptChat: Boolean(snap?.chat?.length) })
    return true
  } catch (e) {
    console.error('[workspaceSession] clear broken failed', e)
    return false
  }
}

export function clearWorkspaceSnapshot() {
  try {
    localStorage.removeItem(WORKSPACE_SNAPSHOT_KEY)
    return true
  } catch {
    return false
  }
}
