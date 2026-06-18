/**
 * Material schedule audit — compare actual rows against chat import baseline.
 */

import { consolidateExtractForImport } from './chatExtract.js'
import {
  categorySubtotal,
  materialsGrandTotal,
  materialRowAmount,
  normalizeMaterialItemKey,
  dedupeMaterialRows,
} from './materialCategories.js'
import { hasCommercialBreakdown, parseCommercialBreakdown } from './commercialBreakdown.js'

const TOLERANCE = 0.02

export { dedupeMaterialRows, materialRowAmount, normalizeMaterialItemKey } from './materialCategories.js'

/** Remove duplicate, stale, and excess rows so schedule matches commercial summary. */
export function sanitizeMaterialSchedule(rows = [], expectedTotal = null, { freshImport = false } = {}) {
  let list = dedupeMaterialRows(rows.map(r => ({ ...r })))
  const removed = []

  if (freshImport) {
    const kept = []
    for (const row of list) {
      if (row.source === 'carried-forward') {
        removed.push(row)
        continue
      }
      kept.push(row)
    }
    list = kept
  }

  const byKey = new Map()
  for (const row of list) {
    const key = normalizeMaterialItemKey(row)
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(row)
  }
  for (const [, group] of byKey) {
    if (group.length <= 1) continue
    for (let i = 1; i < group.length; i++) {
      removed.push(group[i])
      list = list.filter(r => r.id !== group[i].id)
    }
  }

  if (expectedTotal != null && expectedTotal > 0) {
    let sum = materialsGrandTotal(list)
    if (sum > expectedTotal + TOLERANCE) {
      const suspicious = [...list]
        .filter(r => ['carried-forward', 'duplicate', 'user', 'unknown'].includes(String(r.source || 'unknown')))
        .sort((a, b) => materialRowAmount(b) - materialRowAmount(a))

      for (const row of suspicious) {
        if (sum <= expectedTotal + TOLERANCE) break
        removed.push(row)
        list = list.filter(r => r.id !== row.id)
        sum -= materialRowAmount(row)
      }
    }
  }

  return { materials: list, removed }
}

/** Trim schedule down to commercial summary total by removing lowest-priority rows first. */
export function trimMaterialScheduleToExpected(rows = [], expectedTotal, baselineRows = []) {
  if (!expectedTotal || expectedTotal <= 0) return rows
  let list = [...rows]
  let sum = materialsGrandTotal(list)
  if (sum <= expectedTotal + TOLERANCE) return list

  const baselineKeys = new Set((baselineRows || []).map(normalizeMaterialItemKey))
  const keepPriority = (row) => {
    if (baselineKeys.has(normalizeMaterialItemKey(row))) return 100
    const source = String(row.source || 'unknown').toLowerCase()
    if (source === 'carried-forward') return 0
    if (source === 'duplicate') return 1
    if (source === 'user' || source === 'unknown') return 2
    if (source === 'doc-gen') return 3
    if (source === 'ai-chat' || source === 'ai-chat-import' || source === 'ai-material') return 5
    return 4
  }

  const candidates = list
    .filter(r => keepPriority(r) < 100)
    .sort((a, b) => keepPriority(a) - keepPriority(b) || materialRowAmount(b) - materialRowAmount(a))

  for (const row of candidates) {
    if (sum <= expectedTotal + TOLERANCE) break
    list = list.filter(r => r.id !== row.id)
    sum -= materialRowAmount(row)
  }
  return list
}

export function resolveCommercialBreakdown(intelligence = {}, chatExtract = null) {
  if (intelligence?.commercialBreakdown?.materials > 0) return intelligence.commercialBreakdown
  if (chatExtract?.commercialBreakdown?.materials > 0) return chatExtract.commercialBreakdown
  if (chatExtract?.sourceText) return parseCommercialBreakdown(chatExtract.sourceText)
  return intelligence?.commercialBreakdown || {}
}

/** Reconcile material schedule to commercial summary / import baseline. */
export function reconcileMaterialSchedule(
  rows = [],
  { commercialBreakdown = {}, importBaseline = null, freshImport = false } = {},
) {
  const expectedTotal = commercialBreakdown?.materials
    ?? importBaseline?.expectedMaterialsTotal
    ?? importBaseline?.commercialBreakdown?.materials

  let materials = dedupeMaterialRows(rows || [])
  if (!expectedTotal || expectedTotal <= 0) return materials

  materials = sanitizeMaterialSchedule(materials, expectedTotal, { freshImport }).materials
  return trimMaterialScheduleToExpected(
    materials,
    expectedTotal,
    importBaseline?.materials || [],
  )
}

function resolveCommercialFromExtract(extract) {
  if (!extract) return {}
  if (extract.commercialBreakdown?.materials > 0) return extract.commercialBreakdown
  if (extract.sourceText) return parseCommercialBreakdown(extract.sourceText)
  return {}
}

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
  const commercialBreakdown = extract.commercialBreakdown || {}
  const hasCommercial = hasCommercialBreakdown(commercialBreakdown)
  if (!extract?.materials?.length && !hasCommercial) return null

  const consolidated = consolidateExtractForImport({
    boqRows: extract.boqRows || [],
    materials: extract.materials || [],
    labor: extract.labor || [],
    matCategories: extract.matCategories || [],
  })

  let materials = (consolidated.materials || []).map(m => ({
    ...m,
    source: m.source || 'ai-chat-import',
  }))

  materials = dedupeMaterialRows(materials)
  const expectedMaterials = commercialBreakdown.materials ?? materialsGrandTotal(materials)
  if (commercialBreakdown.materials > 0) {
    materials = sanitizeMaterialSchedule(materials, commercialBreakdown.materials, { freshImport: true }).materials
  }

  if (!materials.length && !hasCommercial) return null

  return {
    materials,
    matCategories: consolidated.matCategories || [],
    materialTotal: materialsGrandTotal(materials),
    expectedMaterialsTotal: expectedMaterials,
    commercialBreakdown,
    contractSum: commercialBreakdown.contractSum || parseFloat(extract.contractSum) || null,
    importedAt: new Date().toISOString(),
    messageRef: extract.messageId || null,
  }
}

function resolveExpectedMaterials({ importBaseline, chatExtractFallback, commercialBreakdown }) {
  const commercialExpected = commercialBreakdown?.materials
    ?? importBaseline?.commercialBreakdown?.materials
    ?? importBaseline?.expectedMaterialsTotal
    ?? resolveCommercialFromExtract(chatExtractFallback).materials

  if (importBaseline?.materials?.length) {
    return {
      materials: importBaseline.materials,
      total: commercialExpected ?? importBaseline.materialTotal ?? materialsGrandTotal(importBaseline.materials),
      origin: commercialExpected
        ? 'Chat commercial summary (Materials)'
        : 'Stored import baseline',
    }
  }

  if (chatExtractFallback?.materials?.length) {
    const consolidated = consolidateExtractForImport({
      boqRows: chatExtractFallback.boqRows || [],
      materials: chatExtractFallback.materials || [],
      matCategories: chatExtractFallback.matCategories || [],
    })
    const materials = dedupeMaterialRows(consolidated.materials || [])
    return {
      materials,
      total: commercialExpected ?? materialsGrandTotal(materials),
      origin: commercialExpected
        ? 'Latest chat commercial summary'
        : 'Latest chat extract',
    }
  }

  if (commercialExpected > 0) {
    return {
      materials: [],
      total: commercialExpected,
      origin: 'Chat commercial summary (Materials)',
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
  commercialBreakdown = null,
} = {}) {
  const expected = resolveExpectedMaterials({ importBaseline, chatExtractFallback, commercialBreakdown })
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
