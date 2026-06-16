import {
  loadVariationOrders,
  persistVariationOrders,
  saveVariationOrder,
  deleteVariationOrder,
  createNewVariationOrder,
} from '../utils/variationOrderStore.js'
import { applyCalculationsToOrder } from '../utils/variationCalculations.js'
import {
  fetchCloudVariationOrders,
  upsertCloudVariationOrder,
  deleteCloudVariationOrder,
} from './supabase/variationOrdersCloud.js'
import { checkSupabaseConnection } from './supabase/client.js'

export const VO_CLOUD_WARNING =
  'Cloud saving is not configured. Variation orders are only saved on this device.'

function mergeOrders(cloudOrders, localOrders) {
  const byId = new Map()
  for (const vo of localOrders) byId.set(vo.id, vo)
  for (const vo of cloudOrders) {
    const existing = byId.get(vo.id)
    if (!existing || new Date(vo.updatedAt) >= new Date(existing.updatedAt)) {
      byId.set(vo.id, vo)
    }
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
  )
}

export async function loadAllVariationOrders() {
  const localOrders = loadVariationOrders()
  const health = await checkSupabaseConnection()

  if (!health.ok) {
    return { orders: localOrders, error: null, cloudActive: false }
  }

  const { orders: cloudOrders, error } = await fetchCloudVariationOrders()
  if (error) {
    return { orders: localOrders, error, cloudActive: false }
  }

  const merged = mergeOrders(cloudOrders, localOrders)
  persistVariationOrders(merged)
  return { orders: merged, error: null, cloudActive: true }
}

export async function saveVariationOrderUnified(vo) {
  const normalized = applyCalculationsToOrder(vo)
  const saved = saveVariationOrder(normalized)
  if (!saved) {
    return { ok: false, error: 'Could not save variation order locally' }
  }

  const health = await checkSupabaseConnection()
  if (!health.ok) {
    return { ok: true, order: saved, warning: VO_CLOUD_WARNING, cloudActive: false }
  }

  const cloud = await upsertCloudVariationOrder(saved)
  if (!cloud.ok) {
    return { ok: true, order: saved, warning: cloud.error || VO_CLOUD_WARNING, cloudActive: false }
  }

  return { ok: true, order: saved, cloudActive: true }
}

export async function deleteVariationOrderUnified(id) {
  const ok = deleteVariationOrder(id)
  if (!ok) return { ok: false, error: 'Variation order not found locally' }

  const health = await checkSupabaseConnection()
  if (!health.ok) return { ok: true, error: VO_CLOUD_WARNING }

  const cloud = await deleteCloudVariationOrder(id)
  if (!cloud.ok) return { ok: true, error: cloud.error }
  return { ok: true }
}

export { createNewVariationOrder }
