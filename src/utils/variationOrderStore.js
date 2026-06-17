/** Local persistence for Variation Orders. */

import { VO_STORAGE_KEY, createVariationOrder } from './variationOrderTypes.js'
import { applyCalculationsToOrder } from './variationCalculations.js'
import { safeLocalStorageSetItem, safeParseJson } from './safeSerialize.js'

export function loadVariationOrders() {
  try {
    const raw = localStorage.getItem(VO_STORAGE_KEY)
    if (!raw) return []
    const parsed = safeParseJson(raw, [])
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function persistVariationOrders(orders) {
  const result = safeLocalStorageSetItem(VO_STORAGE_KEY, orders)
  if (!result.ok) {
    console.error('[variationOrders] persist failed', result.error)
    return false
  }
  return true
}

export function saveVariationOrder(vo) {
  const orders = loadVariationOrders()
  const normalized = applyCalculationsToOrder(vo)
  const idx = orders.findIndex(o => o.id === normalized.id)
  const next = idx >= 0
    ? orders.map((o, i) => (i === idx ? normalized : o))
    : [normalized, ...orders]
  return persistVariationOrders(next) ? normalized : null
}

export function deleteVariationOrder(id) {
  const orders = loadVariationOrders()
  const next = orders.filter(o => o.id !== id)
  if (next.length === orders.length) return false
  return persistVariationOrders(next)
}

export function getVariationOrder(id) {
  return loadVariationOrders().find(o => o.id === id) || null
}

export function createNewVariationOrder(partial = {}) {
  const existing = loadVariationOrders()
  const vo = createVariationOrder(partial, existing)
  return applyCalculationsToOrder(vo)
}

export function getVariationsForProject(projectId) {
  if (!projectId) return loadVariationOrders()
  return loadVariationOrders().filter(o => o.projectId === projectId)
}
