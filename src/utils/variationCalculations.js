/** Variation Order financial calculations. */

import { CHANGE_TYPES } from './variationOrderTypes.js'

function parseNum(v) {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

const ADDITION_TYPES = new Set([
  CHANGE_TYPES.ADDITION,
  CHANGE_TYPES.PROVISIONAL,
])

const OMISSION_TYPES = new Set([
  CHANGE_TYPES.OMISSION,
])

const REDUCTION_TYPES = new Set([
  CHANGE_TYPES.REDUCTION,
])

const INCREASE_TYPES = new Set([
  CHANGE_TYPES.INCREASE,
])

const ADJUSTMENT_TYPES = new Set([
  CHANGE_TYPES.SUBSTITUTION,
  CHANGE_TYPES.RATE_ADJUSTMENT,
  CHANGE_TYPES.QUANTITY_ADJUSTMENT,
  CHANGE_TYPES.CLIENT_SUPPLIED,
  CHANGE_TYPES.OPTIONAL,
])

export function computeVariationTotals(items = [], originalEstimateTotal = 0) {
  const original = parseNum(originalEstimateTotal)
  let totalAdditions = 0
  let totalOmissions = 0
  let totalReductions = 0
  let totalIncreases = 0
  let totalAdjustments = 0
  let netVariation = 0

  for (const item of items) {
    const diff = parseNum(item.difference)
    if (item.status === 'rejected') continue

    netVariation += diff

    if (ADDITION_TYPES.has(item.changeType) && diff > 0) {
      totalAdditions += diff
    } else if (OMISSION_TYPES.has(item.changeType) && diff < 0) {
      totalOmissions += Math.abs(diff)
    } else if (REDUCTION_TYPES.has(item.changeType) && diff < 0) {
      totalReductions += Math.abs(diff)
    } else if (INCREASE_TYPES.has(item.changeType) && diff > 0) {
      totalIncreases += diff
    } else if (ADJUSTMENT_TYPES.has(item.changeType)) {
      totalAdjustments += diff
    } else if (diff > 0) {
      totalAdditions += diff
    } else if (diff < 0) {
      totalOmissions += Math.abs(diff)
    }
  }

  const revisedTotal = Math.round((original + netVariation) * 100) / 100

  return {
    totalAdditions: Math.round(totalAdditions * 100) / 100,
    totalOmissions: Math.round(totalOmissions * 100) / 100,
    totalReductions: Math.round(totalReductions * 100) / 100,
    totalIncreases: Math.round(totalIncreases * 100) / 100,
    totalAdjustments: Math.round(totalAdjustments * 100) / 100,
    netVariation: Math.round(netVariation * 100) / 100,
    originalEstimateTotal: original,
    revisedTotal,
  }
}

export function recalcVariationItem(item) {
  const originalAmount = Math.round(
    parseNum(item.originalQty) * parseNum(item.originalRate) * 100,
  ) / 100
  const revisedAmount = Math.round(
    parseNum(item.revisedQty) * parseNum(item.revisedRate) * 100,
  ) / 100
  const difference = Math.round((revisedAmount - originalAmount) * 100) / 100
  return { ...item, originalAmount, revisedAmount, difference }
}

export function recalcAllItems(items) {
  return items.map((item, i) => ({
    ...recalcVariationItem(item),
    itemNo: i + 1,
  }))
}

export function applyCalculationsToOrder(vo) {
  const items = recalcAllItems(vo.items || [])
  const calculations = computeVariationTotals(items, vo.originalEstimateTotal)
  return {
    ...vo,
    items,
    ...calculations,
    revisedTotal: calculations.revisedTotal,
    updatedAt: new Date().toISOString(),
  }
}
