import {
  loadVariationOrders,
  persistVariationOrders,
  saveVariationOrder,
  deleteVariationOrder,
  createNewVariationOrder,
} from '../utils/variationOrderStore.js'
import { applyCalculationsToOrder, computeVariationTotals } from '../utils/variationCalculations.js'
import {
  fetchCloudVariationOrders,
  upsertCloudVariationOrder,
  deleteCloudVariationOrder,
} from './supabase/variationOrdersCloud.js'
import { upsertCloudRevisedDocument } from './supabase/revisedDocumentsCloud.js'
import { variationOrderToRevisedDocument } from '../../lib/revisedDocumentMapper.js'
import {
  createRevisedDocument,
  getSavedDocument,
  nextRevisionForDocument,
  saveDocument,
} from '../utils/savedDocuments.js'
import { checkSupabaseConnection } from './supabase/client.js'

export const VO_CLOUD_WARNING =
  'Cloud saving is not configured. Variation orders are only saved on this device.'

export const REVISED_CLOUD_WARNING =
  'Revised document cloud table unavailable — saved locally only. Run supabase/schema.sql in Supabase SQL Editor.'

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

  const calculations = computeVariationTotals(saved.items, saved.originalEstimateTotal)
  const revisedDoc = variationOrderToRevisedDocument(saved, calculations)

  const health = await checkSupabaseConnection()
  const warnings = []

  if (!health.ok) {
    warnings.push(VO_CLOUD_WARNING)
    return {
      ok: true,
      order: saved,
      revisedDocument: revisedDoc,
      warning: warnings.join(' '),
      cloudActive: false,
    }
  }

  const cloudVo = await upsertCloudVariationOrder(saved)
  if (!cloudVo.ok) {
    warnings.push(cloudVo.error || VO_CLOUD_WARNING)
  }

  const cloudRevised = await upsertCloudRevisedDocument(revisedDoc)
  if (!cloudRevised.ok) {
    warnings.push(cloudRevised.error || REVISED_CLOUD_WARNING)
  }

  return {
    ok: true,
    order: saved,
    revisedDocument: revisedDoc,
    warning: warnings.length ? warnings.join(' ') : null,
    cloudActive: cloudVo.ok && cloudRevised.ok,
    cloudVoOk: cloudVo.ok,
    cloudRevisedOk: cloudRevised.ok,
  }
}

export async function saveRevisedDocumentUnified(vo) {
  const normalized = applyCalculationsToOrder(vo)
  const calculations = computeVariationTotals(normalized.items, normalized.originalEstimateTotal)
  const revisedDoc = variationOrderToRevisedDocument(normalized, calculations)

  let localDoc = null
  const parent = normalized.originalEstimateId
    ? getSavedDocument(normalized.originalEstimateId)
    : null

  if (parent) {
    const revisionNumber = nextRevisionForDocument(parent.id)
    localDoc = createRevisedDocument({
      parentDocument: parent,
      revisionNumber,
      variationOrderId: normalized.id,
      variationNumber: normalized.variationNumber,
      name: `${parent.name} — ${normalized.variationNumber}`,
      snapshot: {
        meta: {
          clientName: normalized.clientName,
          projectTitle: normalized.projectName,
          projectLocation: normalized.projectLocation,
          quoteNum: normalized.originalEstimateRef,
        },
        variationSummary: calculations,
        variations: normalized.items,
        revision: {
          revisionNumber,
          variationOrderId: normalized.id,
          variationNumber: normalized.variationNumber,
          originalDocumentId: parent.id,
          originalTotal: calculations.originalEstimateTotal,
          calculations,
          items: normalized.items,
          status: normalized.status,
        },
      },
    })
    if (!saveDocument(localDoc)) {
      return { ok: false, error: 'Could not save revised document locally' }
    }
  }

  const health = await checkSupabaseConnection()
  if (!health.ok) {
    return {
      ok: true,
      revisedDocument: revisedDoc,
      localDocument: localDoc,
      warning: REVISED_CLOUD_WARNING,
      cloudActive: false,
    }
  }

  const cloud = await upsertCloudRevisedDocument(revisedDoc)
  if (!cloud.ok) {
    return {
      ok: true,
      revisedDocument: revisedDoc,
      localDocument: localDoc,
      warning: cloud.error || REVISED_CLOUD_WARNING,
      cloudActive: false,
    }
  }

  return {
    ok: true,
    revisedDocument: revisedDoc,
    localDocument: localDoc,
    cloudActive: true,
  }
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
