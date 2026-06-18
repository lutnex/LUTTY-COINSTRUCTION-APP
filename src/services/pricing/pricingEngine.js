/**
 * Transparent pricing engine — direct costs only by default.
 *
 * Materials + Labour + Equipment + explicit prelim lines = PROJECT SUBTOTAL
 * Manual financial adjustments (optional, user-enabled) = FINAL CONTRACT SUM
 */

import {
  applyFinancialAdjustments,
  FINANCIAL_ITEM_META,
  createDefaultFinancialAdjustments,
} from '../../utils/financialAdjustments.js'
import {
  computeDirectCostBreakdown,
  BREAKDOWN_LABELS,
} from './directCostBreakdown.js'

export function sumRowAmounts(rows = [], { excludeClientSupply = true } = {}) {
  return rows.reduce((s, r) => {
    if (excludeClientSupply && (r.clientSupplied || r.clientSupply)) return s
    return s + (parseFloat(r.amount) || 0)
  }, 0)
}

/**
 * @param {object} input
 * @param {Array} input.boqRows
 * @param {Array} [input.materials]
 * @param {Array} [input.labor]
 * @param {Array} [input.equipment]
 * @param {Array} [input.prelims] — explicit direct-cost prelim lines only
 * @param {object} [input.financialAdjustments] — manual commercial adjustments
 */
export function computePricing(input = {}) {
  const {
    boqRows = [],
    materials = [],
    labor = [],
    equipment = [],
    prelims = [],
    financialAdjustments: rawAdjustments,
    commercialBreakdown = null,
  } = input

  const financialAdjustments = rawAdjustments && typeof rawAdjustments === 'object'
    ? rawAdjustments
    : createDefaultFinancialAdjustments()

  const breakdown = computeDirectCostBreakdown({
    boqRows,
    materials,
    labor,
    equipment,
    prelims,
    commercialBreakdown,
  })

  const { categories, directTotal, dedupeNotes, warnings } = breakdown

  const matWorks = categories.materials || 0
  const labWorks = categories.labour || 0
  const equipWorks = categories.equipment || 0
  const transportWorks = (categories.transport || 0) + equipWorks
  const prelimExplicit = categories.preliminaries || 0
  const rawWorks = directTotal

  const projectSubtotal = directTotal

  const adjustmentResult = applyFinancialAdjustments(projectSubtotal, financialAdjustments)
  const finalEstimate = adjustmentResult.finalTotal

  const audit = [
    matWorks > 0 && { layer: BREAKDOWN_LABELS.materials, amount: matWorks },
    labWorks > 0 && { layer: BREAKDOWN_LABELS.labour, amount: labWorks },
    categories.earthworks > 0 && { layer: BREAKDOWN_LABELS.earthworks, amount: categories.earthworks },
    categories.filling > 0 && { layer: BREAKDOWN_LABELS.filling, amount: categories.filling },
    categories.transport > 0 && { layer: BREAKDOWN_LABELS.transport, amount: categories.transport },
    categories.equipment > 0 && { layer: BREAKDOWN_LABELS.equipment, amount: categories.equipment },
    prelimExplicit > 0 && { layer: BREAKDOWN_LABELS.preliminaries, amount: prelimExplicit },
    categories.other > 0 && { layer: BREAKDOWN_LABELS.other, amount: categories.other },
    { layer: 'PROJECT SUBTOTAL', amount: projectSubtotal, bold: false, emphasis: true },
    ...adjustmentResult.enabledLines.map(line => ({
      layer: line.isDeduction ? `− ${line.label}` : `+ ${line.label}`,
      amount: line.amount,
      signed: line.signed,
      isDeduction: line.isDeduction,
      adjustmentId: line.id,
    })),
    { layer: 'FINAL CONTRACT SUM', amount: finalEstimate, bold: true },
  ].filter(Boolean)

  const layers = {
    rawWorks,
    materials: matWorks,
    labour: labWorks,
    earthworks: categories.earthworks || 0,
    filling: categories.filling || 0,
    transport: categories.transport || 0,
    equipment: categories.equipment || 0,
    other: categories.other || 0,
    prelimExplicit,
    projectSubtotal,
    adjustments: adjustmentResult.lines,
    finalEstimate,
    breakdown: categories,
    dedupeNotes,
    warnings: warnings || [],
  }

  const summary = {
    sub: rawWorks,
    mat: matWorks,
    boq: sumRowAmounts(boqRows),
    labour: labWorks,
    equipment: transportWorks,
    prelims: prelimExplicit,
    projectSubtotal,
    cont: adjustmentResult.lines.find(l => l.id === 'contingency')?.amount || 0,
    oh: adjustmentResult.lines.find(l => l.id === 'overheads')?.amount || 0,
    profit: adjustmentResult.lines.find(l => l.id === 'profit')?.amount || 0,
    vat: adjustmentResult.lines.find(l => l.id === 'vat')?.amount || 0,
    discount: adjustmentResult.lines.find(l => l.id === 'discount')?.amount || 0,
    grand: finalEstimate,
    works: rawWorks,
  }

  return {
    mode: 'manual',
    rawWorks,
    directCost: projectSubtotal,
    lineItemsTotal: projectSubtotal,
    layers,
    summary,
    audit,
    adjustmentResult,
    prelimsForDoc: (prelims || []).filter(p => !p.isFinancialAdjustment),
    breakdown,
  }
}

/** BOQ builder footer totals — direct costs + optional manual adjustments. */
export function computeBoqBuilderTotals(rows, options = {}) {
  return computePricing({ boqRows: rows, ...options }).summary
}

export function buildCommercialAuditLabels() {
  return Object.entries(FINANCIAL_ITEM_META).map(([id, m]) => m.label)
}
