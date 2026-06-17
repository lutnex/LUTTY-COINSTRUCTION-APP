/**
 * Strip DOM nodes, React events, refs, and other non-JSON values before persistence.
 */

const REACT_INTERNAL = /^__react|_react|_owner|_store/

export function isDomNode(value) {
  if (value == null || typeof value !== 'object') return false
  if (typeof Element !== 'undefined' && value instanceof Element) return true
  if (typeof Node !== 'undefined' && value instanceof Node) return true
  if (value.nodeType != null && typeof value.nodeName === 'string') return true
  return false
}

export function isEventLike(value) {
  if (value == null || typeof value !== 'object') return false
  if (typeof Event !== 'undefined' && value instanceof Event) return true
  if (value.nativeEvent != null || value.preventDefault != null || value.stopPropagation != null) {
    return true
  }
  return false
}

export function isDomOrEvent(value) {
  return isDomNode(value) || isEventLike(value)
}

/** Read primitive from a select/input change event; never return the event itself. */
export function readSelectValue(event) {
  if (!event) return ''
  const target = event.target
  if (!target || typeof target.value === 'undefined') return ''
  return target.value
}

export function readCheckboxChecked(event) {
  return Boolean(event?.target?.checked)
}

/** Coerce a field value — if an event/DOM node was passed by mistake, extract primitive or drop. */
export function coerceFieldValue(value) {
  if (value == null) return value
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (isDomOrEvent(value)) {
    const target = value.target
    if (target && typeof target.checked === 'boolean') return target.checked
    if (target && typeof target.value !== 'undefined') return target.value
    console.warn('[safeSerialize] dropped DOM/event value passed as field data')
    return undefined
  }
  if (typeof value === 'object') {
    console.warn('[safeSerialize] dropped non-primitive object passed as field value')
    return undefined
  }
  return value
}

/** Sanitize a shallow patch object before merging into app state. */
export function sanitizePatch(patch) {
  if (patch == null) return {}
  if (isDomOrEvent(patch)) return {}
  if (typeof patch !== 'object' || Array.isArray(patch)) return {}

  const out = {}
  for (const [key, value] of Object.entries(patch)) {
    if (REACT_INTERNAL.test(key)) continue
    if (typeof value === 'function') continue
    if (isDomOrEvent(value)) {
      console.warn(`[safeSerialize] skipped non-serializable patch field "${key}"`)
      continue
    }
    if (value != null && typeof value === 'object') {
      try {
        JSON.stringify(value)
        out[key] = value
      } catch {
        console.warn(`[safeSerialize] skipped circular patch field "${key}"`)
      }
      continue
    }
    out[key] = value
  }
  return out
}

/** Deep-clone data keeping only JSON-safe values. */
export function sanitizeSerializableState(value, seen = new WeakSet()) {
  if (value == null) return value

  const t = typeof value
  if (t === 'string' || t === 'number' || t === 'boolean') return value
  if (t === 'function' || t === 'symbol' || t === 'bigint') return undefined
  if (isDomOrEvent(value)) return undefined

  if (t !== 'object') return undefined

  if (seen.has(value)) return undefined
  seen.add(value)

  if (Array.isArray(value)) {
    return value
      .map(item => sanitizeSerializableState(item, seen))
      .filter(item => item !== undefined)
  }

  if (value instanceof Date) return value.toISOString()

  const out = {}
  for (const [key, child] of Object.entries(value)) {
    if (REACT_INTERNAL.test(key)) continue
    const clean = sanitizeSerializableState(child, seen)
    if (clean !== undefined) out[key] = clean
  }
  return out
}

export function safeStringify(value, space) {
  try {
    const clean = sanitizeSerializableState(value)
    return JSON.stringify(clean, null, space)
  } catch (e) {
    console.warn('[safeSerialize] safeStringify failed', e)
    return null
  }
}

export function safeParseJson(raw, fallback = null) {
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw)
    return sanitizeSerializableState(parsed)
  } catch (e) {
    console.warn('[safeSerialize] safeParseJson failed', e)
    return fallback
  }
}

/** Persist JSON to localStorage; never throws on circular structures. */
export function safeLocalStorageSetItem(key, value) {
  const json = safeStringify(value)
  if (json == null) {
    return { ok: false, error: 'State could not be serialized' }
  }
  try {
    localStorage.setItem(key, json)
    return { ok: true }
  } catch (e) {
    console.error(`[safeSerialize] localStorage.setItem failed for ${key}`, e)
    return { ok: false, error: e?.message || 'Storage write failed' }
  }
}

export function safeJsonClone(value) {
  const json = safeStringify(value)
  if (json == null) return null
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}
