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
    extract: m.extract || null,
    docName: m.docName,
    attachMeta: m.attachMeta || null,
  }))
}

export function saveChatSession(msgs = []) {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      msgs: serializeChatMessages(msgs),
    }))
    return true
  } catch (e) {
    console.error('[chatStore] save failed', e)
    return false
  }
}

export function loadChatSession() {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
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
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      ...session,
    }))
    return true
  } catch (e) {
    console.error('[sessionStore] save failed', e)
    return false
  }
}

export function loadAppSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearAppSession() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY)
  } catch { /* ignore */ }
}
