/**
 * Single source of truth for project estimates across AI Chat, BOQ Builder,
 * Document Generator, PDF Export, and Variation Orders.
 */

import { computePricing } from '../services/pricing/pricingEngine.js'
import {
  createDefaultFinancialAdjustments,
  FINANCIAL_ITEM_ORDER,
} from './financialAdjustments.js'

export const ESTIMATE_SOURCES = {
  AI_CHAT: 'ai-chat',
  BOQ_BUILDER: 'boq-builder',
  DOC_GEN: 'doc-generator',
  VARIATION: 'variation-order',
  USER_OVERRIDE: 'user-override',
  PROJECT: 'project',
}

export const APPROVAL_MODES = {
  DIRECT_ONLY: 'direct-only',
  PRELIMINARIES: 'preliminaries',
  OVERHEADS: 'overheads',
  PROFIT: 'profit',
  CONTINGENCY: 'contingency',
  CUSTOM: 'custom',
}

export const ESTIMATE_MISMATCH_MESSAGE = 'Estimate mismatch detected. Export blocked.'

const TOLERANCE = 0.02

function sumCategory(rows = [], { excludeClientSupply = true } = {}) {
  const total = rows.reduce((s, r) => {
    if (excludeClientSupply && (r.clientSupplied || r.clientSupply)) return s
    return s + (parseFloat(r.amount) || 0)
  }, 0)
  return { items: rows, total }
}

/**
 * @param {object} input
 * @param {string} [input.source]
 */
export function buildProjectEstimate(input = {}) {
  const {
    boqRows = [],
    materials = [],
    labor = [],
    equipment = [],
    prelims = [],
    financialAdjustments,
    source = ESTIMATE_SOURCES.AI_CHAT,
  } = input

  const pricing = computePricing({
    boqRows,
    materials,
    labor,
    equipment,
    prelims,
    financialAdjustments: financialAdjustments ?? createDefaultFinancialAdjustments(),
  })

  const matRows = materials.length ? materials : boqRows
  const materialsCat = sumCategory(matRows)
  const labourCat = sumCategory(labor, { excludeClientSupply: false })
  const transportCat = sumCategory(equipment, { excludeClientSupply: false })
  const prelimCat = {
    items: (prelims || []).filter(p => !p.isFinancialAdjustment),
    total: pricing.layers.prelimExplicit || 0,
  }

  const commercials = {}
  for (const id of FINANCIAL_ITEM_ORDER) {
    const line = pricing.adjustmentResult?.lines?.find(l => l.id === id)
    commercials[id] = {
      enabled: Boolean(line),
      amount: line?.amount || 0,
      source,
    }
  }

  return {
    materials: { ...materialsCat, source },
    labour: { ...labourCat, source },
    transport: { ...transportCat, source },
    preliminaries: { ...prelimCat, source },
    contingency: commercials.contingency,
    overheads: commercials.overheads,
    profit: commercials.profit,
    vat: commercials.vat,
    discount: commercials.discount,
    commercials,
    directCostTotal: pricing.layers.projectSubtotal,
    approvedTotal: pricing.layers.finalEstimate,
    locked: false,
    lockedAt: null,
    approvalMode: null,
    approvedCommercials: [],
    pricingSnapshot: null,
    financialAdjustmentsSnapshot: null,
    traceability: buildTraceability({ source, pricing }),
  }
}

function buildTraceability({ source, pricing }) {
  const rows = []
  if (pricing.layers.rawWorks > 0) {
    rows.push({ category: 'Materials / Works', amount: pricing.layers.rawWorks, source })
  }
  if (pricing.layers.labour > 0) {
    rows.push({ category: 'Labour', amount: pricing.layers.labour, source })
  }
  if (pricing.layers.equipment > 0) {
    rows.push({ category: 'Transport / Equipment', amount: pricing.layers.equipment, source })
  }
  if (pricing.layers.prelimExplicit > 0) {
    rows.push({ category: 'Preliminaries', amount: pricing.layers.prelimExplicit, source })
  }
  for (const line of pricing.adjustmentResult?.enabledLines || []) {
    rows.push({ category: line.label, amount: line.amount, source, isCommercial: true })
  }
  rows.push({ category: 'Final Total', amount: pricing.layers.finalEstimate, source })
  return rows
}

/**
 * Build financial adjustments from user approval choices.
 * Never enables commercials unless explicitly selected.
 */
export function financialAdjustmentsFromApproval(approval = {}, existing = null) {
  const base = existing && typeof existing === 'object'
    ? { ...createDefaultFinancialAdjustments(), ...existing }
    : createDefaultFinancialAdjustments()

  const modes = Array.isArray(approval.modes) ? approval.modes : [approval.mode || APPROVAL_MODES.DIRECT_ONLY]
  const directOnly = modes.includes(APPROVAL_MODES.DIRECT_ONLY) && modes.length === 1

  if (directOnly) {
    return createDefaultFinancialAdjustments()
  }

  const next = { ...base }
  for (const id of FINANCIAL_ITEM_ORDER) {
    next[id] = { ...next[id], enabled: false }
  }

  const enableMap = {
    [APPROVAL_MODES.CONTINGENCY]: 'contingency',
    [APPROVAL_MODES.OVERHEADS]: 'overheads',
    [APPROVAL_MODES.PROFIT]: 'profit',
  }

  for (const mode of modes) {
    const key = enableMap[mode]
    if (key && next[key]) {
      const customVal = approval.customPercentages?.[key]
      const defaultPct = { contingency: '5', overheads: '10', profit: '10', vat: '15' }
      next[key] = {
        ...next[key],
        enabled: true,
        mode: 'percentage',
        value: customVal != null && customVal !== '' ? String(customVal) : (defaultPct[key] || '10'),
      }
    }
  }

  if (modes.includes(APPROVAL_MODES.CUSTOM) && approval.customPercentages) {
    for (const [key, val] of Object.entries(approval.customPercentages)) {
      if (next[key] && val != null && val !== '') {
        next[key] = { ...next[key], enabled: true, mode: 'percentage', value: String(val) }
      }
    }
  }

  return next
}

/**
 * Lock estimate after user approval. Returns immutable snapshot for all modules.
 */
export function lockProjectEstimate(estimate, approval, input = {}) {
  const financialAdjustments = financialAdjustmentsFromApproval(
    approval,
    input.financialAdjustments ?? estimate.financialAdjustmentsSnapshot,
  )

  const pricing = computePricing({
    boqRows: input.boqRows ?? [],
    materials: input.materials ?? [],
    labor: input.labor ?? input.labour ?? [],
    equipment: input.equipment ?? [],
    prelims: input.prelims ?? input.preliminaries?.items ?? [],
    financialAdjustments,
  })

  const modes = Array.isArray(approval.modes) ? approval.modes : [approval.mode || APPROVAL_MODES.DIRECT_ONLY]
  const locked = buildProjectEstimate({
    ...input,
    financialAdjustments,
    source: approval.source || estimate?.materials?.source || ESTIMATE_SOURCES.USER_OVERRIDE,
  })

  return {
    ...locked,
    locked: true,
    lockedAt: new Date().toISOString(),
    approvalMode: modes.includes(APPROVAL_MODES.DIRECT_ONLY) ? APPROVAL_MODES.DIRECT_ONLY : modes.join('+'),
    approvedCommercials: modes.filter(m => m !== APPROVAL_MODES.DIRECT_ONLY),
    approvedTotal: pricing.layers.finalEstimate,
    directCostTotal: pricing.layers.projectSubtotal,
    pricingSnapshot: pricing,
    financialAdjustmentsSnapshot: financialAdjustments,
  }
}

/**
 * Unlock a previously approved estimate for editing.
 * Preserves line items and last-approved financial adjustments; live totals recalculate.
 */
export function unlockProjectEstimate(lockedEstimate, input = {}) {
  if (!lockedEstimate?.locked) {
    return lockedEstimate || null
  }

  const financialAdjustments = lockedEstimate.financialAdjustmentsSnapshot
    ?? input.financialAdjustments
    ?? createDefaultFinancialAdjustments()

  const source = lockedEstimate.materials?.source || ESTIMATE_SOURCES.USER_OVERRIDE

  const unlocked = buildProjectEstimate({
    boqRows: input.boqRows ?? [],
    materials: input.materials ?? [],
    labor: input.labor ?? input.labour ?? [],
    equipment: input.equipment ?? [],
    prelims: input.prelims ?? input.preliminaries?.items ?? [],
    financialAdjustments,
    source,
  })

  return {
    ...unlocked,
    locked: false,
    lockedAt: null,
    approvalMode: null,
    approvedCommercials: [],
    pricingSnapshot: null,
    financialAdjustmentsSnapshot: null,
    previousLock: {
      approvedTotal: lockedEstimate.approvedTotal,
      lockedAt: lockedEstimate.lockedAt,
      approvalMode: lockedEstimate.approvalMode,
    },
    unlockedAt: new Date().toISOString(),
  }
}

/** Resolve pricing — returns frozen snapshot when estimate is locked. */
export function resolvePricing(input = {}, projectEstimate = null) {
  if (projectEstimate?.locked && projectEstimate.pricingSnapshot) {
    return projectEstimate.pricingSnapshot
  }
  return computePricing(input)
}

/** Audit panel breakdown for UI display. */
export function buildAuditPanelData(projectEstimate) {
  if (!projectEstimate) return null

  const e = projectEstimate
  const commercialsTotal = (e.contingency?.amount || 0)
    + (e.overheads?.amount || 0)
    + (e.profit?.amount || 0)
    + (e.vat?.amount || 0)
    - (e.discount?.amount || 0)

  return {
    materialsTotal: e.materials?.total || 0,
    labourTotal: e.labour?.total || 0,
    transportTotal: e.transport?.total || 0,
    preliminariesTotal: e.preliminaries?.total || 0,
    commercialsTotal,
    overheads: e.overheads?.amount || 0,
    profit: e.profit?.amount || 0,
    contingency: e.contingency?.amount || 0,
    vat: e.vat?.amount || 0,
    discount: e.discount?.amount || 0,
    directCostTotal: e.directCostTotal || 0,
    finalTotal: e.approvedTotal || 0,
    locked: Boolean(e.locked),
    lockedAt: e.lockedAt,
    traceability: e.traceability || [],
  }
}

/**
 * Collect totals from each module for export validation.
 */
export function collectModuleTotals({ chatEstimate, boqEstimate, docGenEstimate, exportEstimate }) {
  const pick = (est) => {
    if (!est) return null
    if (est.locked) return est.approvedTotal
    return est.approvedTotal ?? est.directCostTotal ?? null
  }

  return {
    chatTotal: pick(chatEstimate),
    boqTotal: pick(boqEstimate),
    docGenTotal: pick(docGenEstimate),
    pdfTotal: pick(exportEstimate),
  }
}

/**
 * Validate that all module totals match within tolerance.
 * @returns {{ ok: boolean, message?: string, totals: object, mismatches: string[] }}
 */
export function validateEstimateParity(moduleTotals) {
  const entries = [
    ['Chat', moduleTotals.chatTotal],
    ['BOQ Builder', moduleTotals.boqTotal],
    ['Document Generator', moduleTotals.docGenTotal],
    ['PDF Export', moduleTotals.pdfTotal],
  ].filter(([, v]) => v != null && Number.isFinite(v))

  if (entries.length < 2) {
    return { ok: true, totals: moduleTotals, mismatches: [] }
  }

  const reference = entries[0][1]
  const mismatches = []

  for (const [label, value] of entries.slice(1)) {
    if (Math.abs(value - reference) > TOLERANCE) {
      mismatches.push(`${entries[0][0]}: GHS ${reference.toLocaleString('en')} vs ${label}: GHS ${value.toLocaleString('en')}`)
    }
  }

  if (mismatches.length) {
    return {
      ok: false,
      message: ESTIMATE_MISMATCH_MESSAGE,
      totals: moduleTotals,
      mismatches,
    }
  }

  return { ok: true, totals: moduleTotals, mismatches: [] }
}

/** Block export unless estimate is locked and totals match. */
export function validateExportGate({ projectEstimate, moduleTotals }) {
  if (!projectEstimate?.locked) {
    return {
      ok: false,
      message: 'Estimate must be approved and locked before export.',
      requiresApproval: true,
    }
  }

  const parity = validateEstimateParity(moduleTotals)
  if (!parity.ok) {
    return { ok: false, message: parity.message, mismatches: parity.mismatches }
  }

  return { ok: true }
}

/**
 * Pick the canonical locked estimate from DocGen vs intelligence (avoids desync).
 * Prefers a fully locked estimate with pricing snapshot.
 */
export function resolveProjectEstimate(docGenEstimate, intelEstimate) {
  const candidates = [docGenEstimate, intelEstimate].filter(Boolean)
  const locked = candidates.find(e => e.locked && e.pricingSnapshot)
  if (locked) return locked
  return docGenEstimate || intelEstimate || null
}

export function isEstimateLocked(docGenEstimate, intelEstimate) {
  const resolved = resolveProjectEstimate(docGenEstimate, intelEstimate)
  return Boolean(resolved?.locked && resolved?.pricingSnapshot)
}

/** Attach locked estimate + parity totals to any export payload. */
export function enrichExportWithEstimate(data, projectEstimate) {
  if (!projectEstimate?.locked) return data
  const totals = collectModuleTotals({
    chatEstimate: projectEstimate,
    boqEstimate: projectEstimate,
    docGenEstimate: projectEstimate,
    exportEstimate: projectEstimate,
  })
  return {
    ...data,
    projectEstimate,
    pricing: projectEstimate.pricingSnapshot,
    contractSum: projectEstimate.approvedTotal,
    _moduleTotals: totals,
  }
}

export function estimateInputFromSnapshot(snapshot = {}) {
  return {
    boqRows: snapshot.boqRows || [],
    materials: snapshot.materials || [],
    labor: snapshot.labor || [],
    prelims: snapshot.prelims || [],
    financialAdjustments: snapshot.financialAdjustments,
  }
}

export function syncEstimateFromPricing(pricing, source, partial = {}) {
  const estimate = buildProjectEstimate({
    boqRows: partial.boqRows || [],
    materials: partial.materials || [],
    labor: partial.labor || [],
    equipment: partial.equipment || [],
    prelims: partial.prelims || [],
    financialAdjustments: partial.financialAdjustments,
    source,
  })

  if (partial.lockedEstimate) {
    return partial.lockedEstimate
  }

  return estimate
}
