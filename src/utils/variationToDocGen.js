/**
 * Apply Variation Order items to Document Generator snapshots.
 * Never mutates the original issued document — produces revised payloads only.
 */

import { normalizeBoqRow } from './boqItemFactory.js'
import { computePricing } from '../services/pricing/pricingEngine.js'
import { CHANGE_TYPES } from './variationOrderTypes.js'
import { recalcVariationItem } from './variationCalculations.js'
import { REVISED_EXPORT_STYLES } from './docGenVariationTypes.js'
import { applyPresentationStyle, PRESENTATION_STYLES } from './qsWorkflow.js'

function parseNum(v) {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function defaultIncludeInTotal(item) {
  if (item.includeInTotal != null) return Boolean(item.includeInTotal)
  if (item.status === 'rejected') return false
  if (item.changeType === CHANGE_TYPES.OPTIONAL) return false
  if (item.changeType === CHANGE_TYPES.PROVISIONAL) return false
  return true
}

export function normalizeVariationItemForDocGen(item, index = 0) {
  const recalc = recalcVariationItem(item)
  return {
    ...recalc,
    includeInTotal: defaultIncludeInTotal(recalc),
    itemNo: recalc.itemNo ?? index + 1,
  }
}

/** Totals respecting includeInTotal and rejected status. */
export function computeVariationTotalsWithInclusion(items = [], originalEstimateTotal = 0) {
  const original = parseNum(originalEstimateTotal)
  let totalAdditions = 0
  let totalOmissions = 0
  let totalReductions = 0
  let totalIncreases = 0
  let totalAdjustments = 0
  let netVariation = 0
  let excludedOptional = 0
  let excludedProvisional = 0

  for (const raw of items) {
    const item = normalizeVariationItemForDocGen(raw)
    if (item.status === 'rejected') continue
    const diff = parseNum(item.difference)
    const included = item.includeInTotal !== false

    if (!included) {
      if (item.changeType === CHANGE_TYPES.OPTIONAL) excludedOptional += Math.abs(diff)
      if (item.changeType === CHANGE_TYPES.PROVISIONAL) excludedProvisional += Math.abs(diff)
      continue
    }

    netVariation += diff
    if (diff > 0 && (item.changeType === CHANGE_TYPES.ADDITION || item.changeType === CHANGE_TYPES.INCREASE)) {
      if (item.changeType === CHANGE_TYPES.INCREASE) totalIncreases += diff
      else totalAdditions += diff
    } else if (diff < 0 && item.changeType === CHANGE_TYPES.OMISSION) {
      totalOmissions += Math.abs(diff)
    } else if (diff < 0 && item.changeType === CHANGE_TYPES.REDUCTION) {
      totalReductions += Math.abs(diff)
    } else if (item.changeType === CHANGE_TYPES.SUBSTITUTION
      || item.changeType === CHANGE_TYPES.RATE_ADJUSTMENT
      || item.changeType === CHANGE_TYPES.QUANTITY_ADJUSTMENT) {
      totalAdjustments += diff
    } else if (diff > 0) {
      totalAdditions += diff
    } else if (diff < 0) {
      totalOmissions += Math.abs(diff)
    }
  }

  const revisedTotal = Math.round((original + netVariation) * 100) / 100

  return {
    originalEstimateTotal: original,
    totalAdditions: Math.round(totalAdditions * 100) / 100,
    totalOmissions: Math.round(totalOmissions * 100) / 100,
    totalReductions: Math.round(totalReductions * 100) / 100,
    totalIncreases: Math.round(totalIncreases * 100) / 100,
    totalAdjustments: Math.round(totalAdjustments * 100) / 100,
    netVariation: Math.round(netVariation * 100) / 100,
    revisedTotal,
    excludedOptional: Math.round(excludedOptional * 100) / 100,
    excludedProvisional: Math.round(excludedProvisional * 100) / 100,
  }
}

function findRowIndex(rows, item) {
  if (item.originalItemRef) {
    const byRef = rows.findIndex(r => r.itemRef === item.originalItemRef)
    if (byRef >= 0) return byRef
  }
  if (item.description) {
    const d = item.description.toLowerCase()
    return rows.findIndex(r => r.desc?.toLowerCase() === d)
  }
  return -1
}

function variationItemToBoqRow(item, index) {
  return normalizeBoqRow({
    section: 'Variations',
    desc: item.description,
    unit: item.unit || 'nr',
    qty: item.revisedQty || item.originalQty,
    rate: item.revisedRate || item.originalRate,
    amount: item.revisedAmount,
    itemRef: item.originalItemRef || `VO-${item.itemNo || index + 1}`,
    source: 'variation',
    optional: item.changeType === CHANGE_TYPES.OPTIONAL,
    provisional: item.changeType === CHANGE_TYPES.PROVISIONAL,
    supplyType: item.changeType === CHANGE_TYPES.OPTIONAL ? 'optional'
      : item.changeType === CHANGE_TYPES.PROVISIONAL ? 'provisional' : undefined,
  }, index)
}

/** Merge variation items into BOQ rows (included items only when applyToTotals). */
export function applyVariationItemsToBoq(originalRows = [], items = [], { applyToTotals = true } = {}) {
  let rows = (originalRows || []).map((r, i) => normalizeBoqRow({ ...r }, i))
  const active = items
    .map(normalizeVariationItemForDocGen)
    .filter(i => i.status !== 'rejected')
    .filter(i => !applyToTotals || i.includeInTotal !== false)

  for (const item of active) {
    const idx = findRowIndex(rows, item)

    switch (item.changeType) {
      case CHANGE_TYPES.ADDITION:
      case CHANGE_TYPES.PROVISIONAL:
      case CHANGE_TYPES.OPTIONAL:
        rows.push(variationItemToBoqRow(item, rows.length))
        break
      case CHANGE_TYPES.OMISSION:
        if (idx >= 0) rows = rows.filter((_, i) => i !== idx)
        break
      case CHANGE_TYPES.REDUCTION:
      case CHANGE_TYPES.QUANTITY_ADJUSTMENT:
        if (idx >= 0) {
          rows[idx] = normalizeBoqRow({
            ...rows[idx],
            qty: item.revisedQty,
            rate: item.revisedRate || rows[idx].rate,
            amount: item.revisedAmount,
          }, idx)
        }
        break
      case CHANGE_TYPES.INCREASE:
      case CHANGE_TYPES.RATE_ADJUSTMENT:
        if (idx >= 0) {
          rows[idx] = normalizeBoqRow({
            ...rows[idx],
            qty: item.revisedQty || rows[idx].qty,
            rate: item.revisedRate || rows[idx].rate,
            amount: item.revisedAmount,
          }, idx)
        }
        break
      case CHANGE_TYPES.SUBSTITUTION:
        if (idx >= 0) rows = rows.filter((_, i) => i !== idx)
        rows.push(variationItemToBoqRow(item, rows.length))
        break
      case CHANGE_TYPES.CLIENT_SUPPLIED:
        if (idx >= 0) {
          rows[idx] = normalizeBoqRow({
            ...rows[idx],
            clientSupplied: true,
            rate: '0',
            amount: '0',
          }, idx)
        } else {
          rows.push(variationItemToBoqRow({ ...item, revisedRate: '0', revisedAmount: 0 }, rows.length))
        }
        break
      default:
        if (idx >= 0) {
          rows[idx] = normalizeBoqRow({
            ...rows[idx],
            qty: item.revisedQty || rows[idx].qty,
            rate: item.revisedRate || rows[idx].rate,
            amount: item.revisedAmount,
          }, idx)
        } else {
          rows.push(variationItemToBoqRow(item, rows.length))
        }
    }
  }

  return rows
}

export function buildVariationScheduleRows(items = []) {
  return items.map(normalizeVariationItemForDocGen)
}

export function buildRevisedDocumentPayload(snapshot, variationDraft, { exportStyle } = {}) {
  if (!snapshot || !variationDraft) return null

  const style = exportStyle || variationDraft.exportStyle || REVISED_EXPORT_STYLES.FULL
  const originalRows = variationDraft.originalBoqSnapshot?.length
    ? variationDraft.originalBoqSnapshot
    : (snapshot.boqRows || [])
  const originalTotal = parseNum(
    variationDraft.originalTotal || snapshot.contractSum || snapshot.pricing?.layers?.finalEstimate,
  )
  const items = variationDraft.items || []
  const calculations = computeVariationTotalsWithInclusion(items, originalTotal)
  const includedItems = items.filter(i => normalizeVariationItemForDocGen(i).includeInTotal !== false)

  let boqRows
  switch (style) {
    case REVISED_EXPORT_STYLES.ADDENDUM:
      boqRows = includedItems.map((item, i) => variationItemToBoqRow(normalizeVariationItemForDocGen(item), i))
      break
    case REVISED_EXPORT_STYLES.FULL:
    case REVISED_EXPORT_STYLES.DETAILED:
      boqRows = applyVariationItemsToBoq(originalRows, includedItems, { applyToTotals: true })
      break
    case REVISED_EXPORT_STYLES.PREMIUM:
      boqRows = applyVariationItemsToBoq(originalRows, includedItems, { applyToTotals: true })
      break
    default:
      boqRows = applyVariationItemsToBoq(originalRows, includedItems, { applyToTotals: true })
  }

  const pricing = computePricing({
    boqRows,
    materials: snapshot.materials || [],
    labor: snapshot.labor || [],
    prelims: snapshot.prelims || [],
    financialAdjustments: snapshot.financialAdjustments,
  })

  const revisionNumber = variationDraft.revisionNumber || 1
  const variationNumber = variationDraft.variationNumber || ''
  const meta = {
    ...(snapshot.meta || {}),
    revisionNumber,
    originalQuoteRef: snapshot.meta?.quoteNum || '',
    originalDocumentDate: snapshot.meta?.date || '',
    variationNumber,
    projectTitle: snapshot.meta?.projectTitle || variationDraft.projectName || '',
    notes: [
      snapshot.meta?.notes || '',
      variationDraft.userNotes || '',
      `Revised estimate — ${variationNumber || 'Variation'} — ${calculations.netVariation >= 0 ? '+' : ''}GHS ${calculations.netVariation.toLocaleString('en')}`,
    ].filter(Boolean).join('\n\n'),
  }

  let presentationStyle = snapshot.presentationStyle || null
  let boqCategorySummaries = snapshot.boqCategorySummaries || null
  if (style === REVISED_EXPORT_STYLES.PREMIUM) {
    const styled = applyPresentationStyle({ boqRows }, PRESENTATION_STYLES.PREMIUM)
    boqRows = styled.boqRows
    boqCategorySummaries = styled.boqCategorySummaries
    presentationStyle = PRESENTATION_STYLES.PREMIUM
  }

  const revision = {
    revisionNumber,
    variationOrderId: variationDraft.variationOrderId || null,
    variationNumber,
    originalDocumentId: variationDraft.originalDocumentId || null,
    originalTotal,
    originalSnapshot: variationDraft.originalSnapshot || snapshot,
    calculations,
    items: buildVariationScheduleRows(items),
    exportStyle: style,
    status: variationDraft.status || 'draft',
    approvedAt: variationDraft.approvedAt || null,
    userNotes: variationDraft.userNotes || '',
  }

  return {
    ...snapshot,
    version: 2,
    docType: style === REVISED_EXPORT_STYLES.PREMIUM ? 'quotation' : (snapshot.docType || 'estimate'),
    meta,
    boqRows,
    contractSum: calculations.revisedTotal,
    pricing,
    presentationStyle,
    boqCategorySummaries,
    transferSource: 'variation-revision',
    revision,
    variations: buildVariationScheduleRows(items),
    variationSummary: calculations,
  }
}

export function variationItemsFromExtract(extract) {
  if (!extract?.variationItems?.length) return []
  return extract.variationItems.map((row, i) => normalizeVariationItemForDocGen({
    description: row.desc || row.description || '',
    changeType: row.changeType || CHANGE_TYPES.ADDITION,
    originalQty: row.qty || row.originalQty || '',
    revisedQty: row.revisedQty || row.qty || '',
    unit: row.unit || 'nr',
    originalRate: row.rate || row.originalRate || '',
    revisedRate: row.revisedRate || row.rate || '',
    originalAmount: row.amount || row.originalAmount || '',
    revisedAmount: row.revisedAmount || row.amount || '',
    reason: row.reason || 'Imported from AI chat',
    status: row.status || 'pending',
    originalItemRef: row.itemRef || '',
  }, i))
}
