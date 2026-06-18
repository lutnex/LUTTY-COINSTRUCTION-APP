/**
 * Material schedule audit — compare actual rows against chat import baseline.
 */

import { consolidateExtractForImport } from './chatExtract.js'
import { categorySubtotal, materialsGrandTotal } from './materialCategories.js'

const TOLERANCE = 0.02

export const MATERIAL_WATCH_GROUPS = [
  { id: 'cement', label: 'Cement', keywords: ['cement', 'opc', 'mortar'] },
  { id: 'blocks', label: 'Blocks', keywords: ['block', 'brick', 'sandcrete'] },
  { id: 'electrical', label: 'Electrical', keywords: ['cable', 'wire', 'socket', 'switch', 'conduit', 'electrical', 'mcb', 'db board'] },
  { id: 'doors', label: 'Doors', keywords: ['door', 'frame', 'ironmongery'] },
  { id: 'ventilation', label: 'Ventilation blocks', keywords: ['ventilation', 'vent block', 'air brick'] },
  { id: 'paint', label: 'Paint', keywords: ['paint', 'primer', 'emulsion', 'putty', 'sealer'] },
  { id: 'roof', label: 'Roof materials', keywords: ['roof', 'aluzinc', 'ridge', 'truss', 'gutter', 'fascia'] },
]

const SOURCE_LABELS = {
  'ai-chat': 'AI Chat Import',
  'ai-chat-import': 'AI Chat Import',
  'ai-material': 'AI Material Schedule',
  'carried-forward': 'Previous Session',
  user: 'Manual Entry',
  duplicate: 'Duplicate Copy',
  'doc-gen': 'Document Generator',
  unknown: 'Unknown',
}

export function materialRowAmount(row = {}) {
  if (row.clientSupply || row.clientSupplied) return 0
  const amt = parseFloat(row.amount)
  if (Number.isFinite(amt) && amt !== 0) return amt
  const qty = parseFloat(row.qty)
  const rate = parseFloat(row.rate)
  if (Number.isFinite(qty) && Number.isFinite(rate)) return Math.round(qty * rate * 100) / 100
  return 0
}

export function normalizeMaterialItemKey(row = {}) {
  const desc = String(row.desc || row.material || '').trim().toLowerCase().replace(/\s+/g, ' ')
  const unit = String(row.unit || '').trim().toLowerCase()
  return `${desc}|${unit}`
}

export function formatMaterialSource(row = {}) {
  const key = String(row.source || 'unknown').toLowerCase()
  return SOURCE_LABELS[key] || row.source || SOURCE_LABELS.unknown
}

function matchWatchGroup(desc = '') {
  const text = desc.toLowerCase()
  return MATERIAL_WATCH_GROUPS.filter(g => g.keywords.some(k => text.includes(k)))
}

function toAuditRow(row, extra = {}) {
  const item = String(row.desc || row.material || '—').trim() || '—'
  return {
    id: row.id ?? `${item}-${row.qty}-${row.rate}`,
    item,
    qty: row.qty ?? '',
    rate: row.clientSupply ? '0' : (row.rate ?? ''),
    amount: materialRowAmount(row),
    source: formatMaterialSource(row),
    sourceKey: row.source || 'unknown',
    raw: row,
    flags: [],
    delta: 0,
    expectedAmount: null,
    watchGroups: matchWatchGroup(item),
    ...extra,
  }
}

/** Snapshot baseline from a fresh chat extract (no merge with prior session). */
export function buildImportBaselineFromExtract(extract = {}) {
  if (!extract?.materials?.length) return null

  const consolidated = consolidateExtractForImport({
    boqRows: extract.boqRows || [],
    materials: extract.materials || [],
    labor: extract.labor || [],
    matCategories: extract.matCategories || [],
  })

  const materials = (consolidated.materials || []).map(m => ({
    ...m,
    source: m.source || 'ai-chat-import',
  }))

  if (!materials.length) return null

  return {
    materials,
    matCategories: consolidated.matCategories || [],
    materialTotal: materialsGrandTotal(materials),
    contractSum: parseFloat(extract.contractSum) || null,
    importedAt: new Date().toISOString(),
    messageRef: extract.messageId || null,
  }
}

function resolveExpectedMaterials({ importBaseline, chatExtractFallback }) {
  if (importBaseline?.materials?.length) {
    return {
      materials: importBaseline.materials,
      total: importBaseline.materialTotal ?? materialsGrandTotal(importBaseline.materials),
      origin: 'Stored import baseline',
    }
  }

  if (chatExtractFallback?.materials?.length) {
    const consolidated = consolidateExtractForImport({
      boqRows: chatExtractFallback.boqRows || [],
      materials: chatExtractFallback.materials || [],
      matCategories: chatExtractFallback.matCategories || [],
    })
    const materials = consolidated.materials || []
    return {
      materials,
      total: materialsGrandTotal(materials),
      origin: 'Latest chat extract',
    }
  }

  return { materials: [], total: 0, origin: 'None — re-import from chat to set expected total' }
}

function indexExpectedRows(expectedMaterials = []) {
  const map = new Map()
  for (const row of expectedMaterials) {
    const key = normalizeMaterialItemKey(row)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(row)
  }
  return map
}

function takeExpectedMatch(index, actualRow) {
  const key = normalizeMaterialItemKey(actualRow)
  const bucket = index.get(key)
  if (!bucket?.length) return null
  return bucket.shift()
}

/**
 * @returns Material audit report with flagged rows causing total difference.
 */
export function buildMaterialAudit({
  materials = [],
  importBaseline = null,
  chatExtractFallback = null,
} = {}) {
  const expected = resolveExpectedMaterials({ importBaseline, chatExtractFallback })
  const actualMaterials = materials || []

  const expectedTotal = expected.total
  const actualTotal = categorySubtotal(actualMaterials)
  const difference = actualTotal - expectedTotal

  const expectedIndex = indexExpectedRows(expected.materials)
  const auditRows = []
  const duplicateTracker = new Map()

  for (const row of actualMaterials) {
    const key = normalizeMaterialItemKey(row)
    duplicateTracker.set(key, (duplicateTracker.get(key) || 0) + 1)
  }

  const matchedExpected = new Set()

  for (const row of actualMaterials) {
    const audit = toAuditRow(row)
    const key = normalizeMaterialItemKey(row)
    const isDuplicate = duplicateTracker.get(key) > 1

    if (isDuplicate) {
      const seen = auditRows.filter(r => normalizeMaterialItemKey(r.raw) === key).length
      if (seen > 0) {
        audit.flags.push('duplicate')
        audit.delta = audit.amount
      }
    }

    const expectedRow = takeExpectedMatch(expectedIndex, row)
    if (expectedRow) {
      matchedExpected.add(expectedRow.id)
      const expAmt = materialRowAmount(expectedRow)
      audit.expectedAmount = expAmt
      if (Math.abs(audit.amount - expAmt) > TOLERANCE) {
        audit.flags.push('modified')
        audit.delta = audit.amount - expAmt
      }
    } else if (!audit.flags.includes('duplicate')) {
      audit.flags.push('extra')
      audit.delta = audit.amount
    }

    if (
      expected.materials.length > 0
      && ['carried-forward', 'user', 'duplicate', 'unknown'].includes(audit.sourceKey)
      && audit.flags.includes('extra')
    ) {
      audit.flags.push('stale')
    }

    auditRows.push(audit)
  }

  for (const [key, bucket] of indexExpectedRows(expected.materials)) {
    for (const row of bucket) {
      if (matchedExpected.has(row.id)) continue
      auditRows.push(toAuditRow(row, {
        flags: ['missing'],
        delta: -materialRowAmount(row),
        expectedAmount: materialRowAmount(row),
        source: 'Expected (missing in schedule)',
        sourceKey: 'expected-missing',
      }))
    }
  }

  const flaggedRows = auditRows
    .filter(r => r.flags.length > 0 && Math.abs(r.delta) > TOLERANCE)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  const flaggedDeltaSum = flaggedRows.reduce((s, r) => s + r.delta, 0)

  const watchSummary = MATERIAL_WATCH_GROUPS.map(group => {
    const rows = auditRows.filter(r =>
      r.watchGroups.some(w => w.id === group.id) && r.flags.length > 0,
    )
    const delta = rows.reduce((s, r) => s + r.delta, 0)
    return { ...group, rowCount: rows.length, delta }
  }).filter(g => g.rowCount > 0)

  return {
    expectedTotal,
    actualTotal,
    difference,
    expectedOrigin: expected.origin,
    hasBaseline: Boolean(importBaseline?.materials?.length),
    rows: auditRows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    flaggedRows,
    flaggedDeltaSum,
    watchSummary,
    summary: {
      totalRows: actualMaterials.length,
      expectedRows: expected.materials.length,
      extra: auditRows.filter(r => r.flags.includes('extra')).length,
      duplicate: auditRows.filter(r => r.flags.includes('duplicate')).length,
      modified: auditRows.filter(r => r.flags.includes('modified')).length,
      missing: auditRows.filter(r => r.flags.includes('missing')).length,
      stale: auditRows.filter(r => r.flags.includes('stale')).length,
    },
  }
}
