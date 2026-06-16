/** Repair corrupted browser storage from older app versions (common on live domains). */

import { INTELLIGENCE_STORAGE_KEY } from './projectIntelligence.js'
import { WORKFLOW_SESSION_KEY } from './workflowActions.js'
import { CHAT_STORAGE_KEY } from './sessionStore.js'

export const STORAGE_SCHEMA_VERSION = 2
const VERSION_KEY = 'constructiq-storage-version'

function repairBoqItems(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'object' && Array.isArray(value.boqRows)) return value.boqRows
  return []
}

function repairIntelligence(raw) {
  if (!raw || typeof raw !== 'object') return null
  const data = { ...raw }
  let changed = false

  if (!Array.isArray(data.boqItems)) {
    data.boqItems = repairBoqItems(data.boqItems)
    changed = true
  }
  if (!Array.isArray(data.assumptions)) {
    data.assumptions = []
    changed = true
  }
  if (!Array.isArray(data.exclusions)) {
    data.exclusions = []
    changed = true
  }
  if (!Array.isArray(data.provisional)) {
    data.provisional = []
    changed = true
  }

  return changed ? data : null
}

function repairChatSession(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (!Array.isArray(raw.msgs)) return { version: 1, msgs: [] }
  let changed = false
  const msgs = raw.msgs.map(m => {
    if (!m?.extract?.boqRows || Array.isArray(m.extract.boqRows)) return m
    changed = true
    return {
      ...m,
      extract: { ...m.extract, boqRows: repairBoqItems(m.extract.boqRows) },
    }
  })
  return changed ? { ...raw, msgs } : null
}

/** Run once on app boot — fixes data that crashes workflow buttons on production. */
export function runStorageMigration() {
  const repairs = []
  try {
    const intelRaw = localStorage.getItem(INTELLIGENCE_STORAGE_KEY)
    if (intelRaw) {
      const parsed = JSON.parse(intelRaw)
      const fixed = repairIntelligence(parsed)
      if (fixed) {
        localStorage.setItem(INTELLIGENCE_STORAGE_KEY, JSON.stringify(fixed))
        repairs.push('project-intelligence')
      }
    }

    const chatRaw = localStorage.getItem(CHAT_STORAGE_KEY)
    if (chatRaw) {
      const parsed = JSON.parse(chatRaw)
      const fixed = repairChatSession(parsed)
      if (fixed) {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(fixed))
        repairs.push('chat-session')
      }
    }

    const wfRaw = localStorage.getItem(WORKFLOW_SESSION_KEY)
    if (wfRaw) {
      const parsed = JSON.parse(wfRaw)
      if (parsed && typeof parsed !== 'object') {
        localStorage.removeItem(WORKFLOW_SESSION_KEY)
        repairs.push('workflow-session-reset')
      }
    }

    localStorage.setItem(VERSION_KEY, String(STORAGE_SCHEMA_VERSION))

    if (repairs.length) {
      console.log('[StorageMigration] Repaired:', repairs.join(', '))
    }
    return { ok: true, repairs }
  } catch (err) {
    console.error('[StorageMigration] failed:', err)
    return { ok: false, error: err?.message }
  }
}
