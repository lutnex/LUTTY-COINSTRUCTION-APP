/**
 * Unified workspace snapshot — chat, intelligence, workflow, and UI state.
 */

import { CHAT_STORAGE_KEY, SESSION_STORAGE_KEY, serializeChatMessages } from './sessionStore.js'
import { INTELLIGENCE_STORAGE_KEY } from './projectIntelligence.js'
import { WORKFLOW_SESSION_KEY } from './workflowActions.js'
import { logSessionDebug } from './sessionDebug.js'
import { sanitizeSerializableState } from './safeSerialize.js'
import { persistJson, loadJson, loadLastValidWorkspaceSnapshot } from './safeStorage.js'

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
  const clean = sanitizeSerializableState(snapshot)
  const result = persistJson(WORKSPACE_SNAPSHOT_KEY, clean, { mirrorValid: true })
  if (result.ok) {
    logSessionDebug('snapshot-saved', {
      msgs: clean?.chat?.length ?? 0,
      boqItems: clean?.intelligence?.boqItems?.length ?? 0,
      tab: clean?.tab,
    })
  } else {
    console.warn('[workspaceSession] save skipped —', result.error)
  }
  return result
}

export function loadWorkspaceSnapshot() {
  return loadJson(WORKSPACE_SNAPSHOT_KEY, null)
}

export function loadValidWorkspaceSnapshot() {
  return loadLastValidWorkspaceSnapshot(WORKSPACE_SNAPSHOT_KEY)
}

/** Restore chat + intelligence + workflow from snapshot into live stores. */
export function applyWorkspaceSnapshotToStorage(snapshot) {
  if (!snapshot) return { ok: false, error: 'No snapshot' }
  const clean = sanitizeSerializableState(snapshot)
  try {
    if (Array.isArray(clean.chat) && clean.chat.length) {
      persistJson(CHAT_STORAGE_KEY, {
        version: 1,
        savedAt: clean.savedAt || new Date().toISOString(),
        msgs: clean.chat,
      })
    }
    if (clean.intelligence && typeof clean.intelligence === 'object') {
      persistJson(INTELLIGENCE_STORAGE_KEY, clean.intelligence)
    }
    if (clean.workflowState && typeof clean.workflowState === 'object') {
      persistJson(WORKFLOW_SESSION_KEY, {
        version: 1,
        savedAt: clean.savedAt || new Date().toISOString(),
        ...clean.workflowState,
      })
    }
    if (clean.tab) {
      persistJson(SESSION_STORAGE_KEY, {
        version: 1,
        savedAt: clean.savedAt || new Date().toISOString(),
        tab: clean.tab,
        activeProjectId: clean.activeProjectId ?? null,
        extractedPrices: clean.extractedPrices ?? [],
        estimatePreferences: clean.estimatePreferences ?? null,
        priceProfileActiveId: clean.priceProfileActiveId ?? null,
      })
    }
    logSessionDebug('snapshot-applied-to-storage', { msgs: clean.chat?.length ?? 0 })
    return { ok: true }
  } catch (e) {
    console.error('[workspaceSession] apply failed', e)
    return { ok: false, error: e?.message }
  }
}

/** Clear corrupted workflow/intelligence keys but keep chat snapshot backup. */
export function clearBrokenWorkspaceData() {
  const snap = loadValidWorkspaceSnapshot() || loadWorkspaceSnapshot()
  try {
    localStorage.removeItem(INTELLIGENCE_STORAGE_KEY)
    localStorage.removeItem(WORKFLOW_SESSION_KEY)
    localStorage.removeItem(WORKSPACE_SNAPSHOT_KEY)
    if (snap?.chat?.length) {
      persistJson(CHAT_STORAGE_KEY, {
        version: 1,
        savedAt: new Date().toISOString(),
        msgs: snap.chat,
      })
    }
    if (snap) {
      persistJson(WORKSPACE_SNAPSHOT_KEY, snap, { mirrorValid: true })
    }
    logSessionDebug('broken-session-cleared', { keptChat: Boolean(snap?.chat?.length), usedValid: true })
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
