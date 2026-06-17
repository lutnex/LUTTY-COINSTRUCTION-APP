import { safeLocalStorageSetItem, safeParseJson, sanitizeSerializableState } from './safeSerialize.js'

export const CHAT_STORAGE_KEY = 'constructiq-chat-session'
export const SESSION_STORAGE_KEY = 'constructiq-app-session'

export function serializeChatMessages(msgs = []) {
  return msgs.map(m => ({
    id: m.id,
    role: m.role,
    content: m.content,
    display: m.display,
    streaming: false,
    failed: m.failed,
    errorStatus: m.errorStatus,
    errorTitle: m.errorTitle,
    tokensIn: m.tokensIn,
    tokensOut: m.tokensOut,
    durationMs: m.durationMs,
    extract: m.extract ? sanitizeSerializableState(m.extract) : null,
    docName: m.docName,
    attachMeta: m.attachMeta || null,
  }))
}

export function saveChatSession(msgs = []) {
  const result = safeLocalStorageSetItem(CHAT_STORAGE_KEY, {
    version: 1,
    savedAt: new Date().toISOString(),
    msgs: serializeChatMessages(msgs),
  })
  if (!result.ok) console.error('[chatStore] save failed', result.error)
  return result.ok
}

export function loadChatSession() {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY)
    const parsed = safeParseJson(raw, null)
    return Array.isArray(parsed?.msgs) ? parsed.msgs : []
  } catch {
    return []
  }
}

export function clearChatSession() {
  try {
    localStorage.removeItem(CHAT_STORAGE_KEY)
  } catch { /* ignore */ }
}

export function saveAppSession(session = {}) {
  const result = safeLocalStorageSetItem(SESSION_STORAGE_KEY, {
    version: 1,
    savedAt: new Date().toISOString(),
    ...session,
  })
  if (!result.ok) console.error('[sessionStore] save failed', result.error)
  return result.ok
}

export function loadAppSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    return safeParseJson(raw, null)
  } catch {
    return null
  }
}

export function clearAppSession() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY)
  } catch { /* ignore */ }
}
