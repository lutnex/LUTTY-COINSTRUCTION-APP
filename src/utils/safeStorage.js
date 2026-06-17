import { safeLocalStorageSetItem, safeParseJson } from './safeSerialize.js'

export const WORKSPACE_SNAPSHOT_VALID_KEY = 'constructiq-workspace-snapshot-valid'

export function persistJson(key, value, { mirrorValid = false } = {}) {
  const result = safeLocalStorageSetItem(key, value)
  if (result.ok && mirrorValid) {
    safeLocalStorageSetItem(WORKSPACE_SNAPSHOT_VALID_KEY, value)
  }
  return result
}

export function loadJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key)
    return safeParseJson(raw, fallback)
  } catch {
    return fallback
  }
}

export function loadLastValidWorkspaceSnapshot(primaryKey) {
  const valid = loadJson(WORKSPACE_SNAPSHOT_VALID_KEY, null)
  if (valid) return valid
  return loadJson(primaryKey, null)
}
