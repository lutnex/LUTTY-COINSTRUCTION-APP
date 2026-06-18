/**
 * Consolidate chat/AI extract into full line-item imports (no commercial summary collapse).
 */

import { normalizeBoqRow } from './boqItemFactory.js'
import { normalizeMaterialState } from './materialCategories.js'
import { dedupeMaterialRows } from './materialCategories.js'

/** Rows that are totals/subtotals — not importable line items. */
export function isCommercialSummaryRow(desc = '', { sectionKind } = {}) {
  const d = String(desc || '').trim()
  if (!d) return true
  if (sectionKind === 'commercial') return true
  return /^(materials\s*\/?\s*works|materials|labou?r|labor|equipment|project\s+subtotal|contract\s+sum|grand\s+total|total\s+value|carried\s+to|collection\s+bill)/i.test(d)
    || /\bsubtotal\s*$/i.test(d)
    || /^total\s+(materials|labou?r|labor|works|equipment|project)/i.test(d)
}

export function classifyTableSection(sectionTitle = '', headerLine = '') {
  const ctx = `${sectionTitle} ${headerLine}`.toLowerCase()
  if (/commercial\s+summary|project\s+subtotal|cost\s+summary|financial\s+summary/.test(ctx)) return 'commercial'
  if (/material\s+breakdown|materials\s+schedule|material\s+schedule|materials\s+breakdown/.test(ctx)) return 'material'
  if (/labou?r\s+breakdown|labou?r\s+schedule|labou?r\s+cost/.test(ctx) || (/\btrade\b/.test(headerLine.toLowerCase()) && /labou?r|labor/.test(ctx))) return 'labor'
  if (/risk\s+register|risk\s+rating/.test(ctx)) return 'risk'
  if (/preliminar/.test(ctx)) return 'prelim'
  if (/bill\s+of\s+quantities|\bboq\b|priced\s+boq|qs\s+workflow[^]*phase\s*4|item\s+ref/.test(ctx)) return 'boq'
  if (/bill\s*\d+|collection\s+bill/.test(ctx)) return 'boq'
  if (/\bsection\b/.test(headerLine.toLowerCase()) && /\bdesc/.test(headerLine.toLowerCase())) return 'boq'
  return 'detail'
}

export function getSectionTitleBefore(text, tableIndex) {
  const before = text.slice(Math.max(0, tableIndex - 1200), tableIndex)
  const headings = [...before.matchAll(/#{2,4}\s+([^\n]+)/g)]
  return headings.length ? headings[headings.length - 1][1].trim() : 'General'
}

function dedupeLineItems(items = []) {
  const out = []
  const seen = new Set()
  for (const row of items) {
    const key = `${row.section || ''}|${row.trade || ''}|${row.desc || ''}|${row.qty || ''}|${row.rate || ''}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

function materialToBoqRow(m, index) {
  return normalizeBoqRow({
    ...m,
    section: m.section || 'Materials',
    desc: m.desc || m.material || 'Material item',
    source: m.source || 'ai-material',
  }, index)
}

function laborToBoqRow(l, index) {
  const trade = l.trade || l.section || 'General'
  return normalizeBoqRow({
    ...l,
    section: l.section?.startsWith('Labour') ? l.section : `Labour — ${trade}`,
    desc: l.desc || trade,
    source: l.source || 'ai-labor',
  }, index)
}

/**
 * Merge BOQ, materials, and labour into intelligence + doc-gen shapes without summary collapse.
 */
export function consolidateExtractForImport(extract = {}) {
  if (!extract) {
    return {
      boqRows: [],
      materials: [],
      matCategories: [],
      labor: [],
      boqItems: [],
      counts: { boq: 0, materials: 0, labor: 0, total: 0 },
    }
  }

  const boqRows = (extract.boqRows || []).filter(r => !isCommercialSummaryRow(r.desc, { sectionKind: r._sectionKind }))
  const materialsRaw = (extract.materials || []).filter(r => !isCommercialSummaryRow(r.desc, { sectionKind: r._sectionKind }))
  const laborRaw = (extract.labor || []).filter(r => !isCommercialSummaryRow(r.desc || r.trade, { sectionKind: r._sectionKind }))

  const { categories, materials } = normalizeMaterialState(
    materialsRaw.map((m, i) => ({ ...m, id: m.id ?? Date.now() + i })),
    extract.matCategories || [],
  )

  const dedupedMaterials = dedupeMaterialRows(materials)

  const labor = laborRaw.map((l, i) => ({
    ...l,
    id: l.id ?? Date.now() + i + 5000,
    trade: l.trade || l.section || 'General',
    desc: l.desc || l.trade || 'Labour item',
  }))

  const unified = dedupeLineItems([
    ...boqRows,
    ...dedupedMaterials.map((m, i) => materialToBoqRow(m, boqRows.length + i)),
    ...labor.map((l, i) => laborToBoqRow(l, boqRows.length + dedupedMaterials.length + i)),
  ])

  const counts = {
    boq: boqRows.length,
    materials: dedupedMaterials.length,
    labor: labor.length,
    total: unified.length,
  }

  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    console.log('[chatExtract] consolidated import', counts)
  }

  return {
    ...extract,
    boqRows,
    materials: dedupedMaterials,
    matCategories: categories,
    labor,
    boqItems: unified,
    counts,
  }
}

export function extractImportSummary(extract) {
  const c = consolidateExtractForImport(extract).counts
  return `${c.total} line items (${c.boq} BOQ · ${c.materials} materials · ${c.labor} labour)`
}
