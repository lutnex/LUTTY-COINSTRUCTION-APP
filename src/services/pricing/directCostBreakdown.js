/**
 * Deduped direct-cost breakdown — prevents double-counting when BOQ rows
 * and parallel materials/labour/prelims arrays contain the same values.
 */

import { createDefaultFinancialAdjustments, FINANCIAL_ITEM_ORDER } from '../../utils/financialAdjustments.js'

export const BREAKDOWN_KEYS = [
  'materials',
  'labour',
  'earthworks',
  'filling',
  'transport',
  'preliminaries',
  'equipment',
  'other',
  'overheads',
  'profit',
  'contingency',
]

export const BREAKDOWN_LABELS = {
  materials: 'Materials',
  labour: 'Labour',
  earthworks: 'Earthworks',
  filling: 'Filling Works',
  transport: 'Transport',
  preliminaries: 'Preliminaries',
  equipment: 'Equipment',
  other: 'Other',
  overheads: 'Overheads',
  profit: 'Profit',
  contingency: 'Contingency',
}

function rowAmount(row, { excludeClientSupply = true } = {}) {
  if (!row) return 0
  if (excludeClientSupply && (row.clientSupplied || row.clientSupply)) return 0
  return parseFloat(row.amount) || 0
}

function sumRows(rows = [], opts = {}) {
  return rows.reduce((s, r) => s + rowAmount(r, opts), 0)
}

/** Classify a BOQ row into a direct-cost category. */
export function classifyBoqRow(row = {}) {
  const section = String(row.section || '').toLowerCase()
  const desc = String(row.desc || '').toLowerCase()
  const text = `${section} ${desc}`

  if (/labou?r/.test(section) || /labou?r/.test(desc)) return 'labour'
  if (/^materials?\b|material\s*(works|schedule)?/.test(section)) return 'materials'
  if (/preliminar/.test(section) || /preliminar/.test(desc)) return 'preliminaries'
  if (/earth\s*works|excavation|cutting|bulk\s*exc/.test(text)) return 'earthworks'
  if (/filling|backfill|compaction/.test(text)) return 'filling'
  if (/transport|haulage|delivery|cartage/.test(text)) return 'transport'
  if (/equipment|plant|machinery|hire/.test(text)) return 'equipment'
  return 'other'
}

function emptyCategories() {
  return {
    materials: 0,
    labour: 0,
    earthworks: 0,
    filling: 0,
    transport: 0,
    preliminaries: 0,
    equipment: 0,
    other: 0,
    overheads: 0,
    profit: 0,
    contingency: 0,
  }
}

/**
 * Compute deduped direct-cost breakdown.
 * @returns {{ categories, directTotal, dedupeNotes, sources }}
 */
export function computeDirectCostBreakdown(input = {}) {
  const {
    boqRows = [],
    materials = [],
    labor = [],
    equipment = [],
    prelims = [],
  } = input

  const categories = emptyCategories()
  const dedupeNotes = []
  const sources = {}

  const hasMaterialsArray = materials.length > 0
  const hasLaborArray = labor.length > 0
  const hasPrelimsArray = (prelims || []).filter(p => !p.isFinancialAdjustment).length > 0
  const hasEquipArray = equipment.length > 0

  const skipFromBoq = new Set()
  if (hasLaborArray) {
    skipFromBoq.add('labour')
    dedupeNotes.push('Labour taken from labour schedule (excluded from BOQ labour rows)')
  }
  if (hasMaterialsArray) {
    skipFromBoq.add('materials')
    dedupeNotes.push('Materials taken from materials schedule (excluded from BOQ material rows)')
  }
  if (hasPrelimsArray) {
    skipFromBoq.add('preliminaries')
    dedupeNotes.push('Preliminaries taken from prelims list (excluded from BOQ prelim rows)')
  }
  if (hasEquipArray) {
    skipFromBoq.add('transport')
    skipFromBoq.add('equipment')
    dedupeNotes.push('Equipment/transport taken from equipment list (excluded from BOQ)')
  }

  for (const row of boqRows) {
    const cat = classifyBoqRow(row)
    if (skipFromBoq.has(cat)) continue
    const amt = rowAmount(row)
    if (amt <= 0) continue
    categories[cat] = (categories[cat] || 0) + amt
    sources[cat] = sources[cat] || 'boq'
  }

  if (hasMaterialsArray) {
    categories.materials += sumRows(materials)
    sources.materials = 'materials-array'
  } else if (!boqRows.length && materials.length) {
    categories.materials += sumRows(materials)
    sources.materials = 'materials-array'
  }

  if (hasLaborArray) {
    categories.labour += sumRows(labor, { excludeClientSupply: false })
    sources.labour = 'labor-array'
  }

  if (hasPrelimsArray) {
    const directPrelims = prelims.filter(p => !p.isFinancialAdjustment)
    categories.preliminaries += directPrelims.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
    sources.preliminaries = 'prelims-array'
  }

  if (hasEquipArray) {
    categories.equipment += sumRows(equipment, { excludeClientSupply: false })
    sources.equipment = 'equipment-array'
  }

  const directKeys = ['materials', 'labour', 'earthworks', 'filling', 'transport', 'preliminaries', 'equipment', 'other']
  const directTotal = directKeys.reduce((s, k) => s + (categories[k] || 0), 0)

  return {
    categories,
    directTotal,
    dedupeNotes,
    sources,
    directKeys,
  }
}

export function buildDirectCostFormula(categories = {}) {
  const directParts = ['materials', 'labour', 'earthworks', 'filling', 'transport', 'preliminaries', 'equipment', 'other']
  const commercialParts = ['overheads', 'profit', 'contingency']
  const allParts = [...directParts, ...commercialParts]
  const expression = `Final Total = ${allParts.map(k => BREAKDOWN_LABELS[k]).join(' + ')}`
  const total = allParts.reduce((s, k) => s + (categories[k] || 0), 0)
  return { expression, parts: allParts, total }
}

/** Pricing input for intelligence: raw BOQ + parallel arrays (not unified duplicate rows). */
export function pricingInputFromConsolidated(consolidated = {}, base = {}) {
  return {
    boqRows: consolidated.boqRows?.length ? consolidated.boqRows : (consolidated.boqItems || []),
    materials: consolidated.materials?.length ? consolidated.materials : (base.materials || []),
    labor: consolidated.labor?.length ? consolidated.labor : (base.labor || []),
    equipment: base.equipment || [],
    prelims: base.prelims || [],
    financialAdjustments: base.financialAdjustments ?? createDefaultFinancialAdjustments(),
  }
}

export function emptyBreakdown() {
  return {
    categories: emptyCategories(),
    directTotal: 0,
    dedupeNotes: [],
    sources: {},
    directKeys: [],
    formula: buildDirectCostFormula(emptyCategories()),
  }
}

export function buildApprovalBreakdown(input = {}) {
  const { categories, directTotal, dedupeNotes, sources, directKeys } = computeDirectCostBreakdown(input)
  const formula = buildDirectCostFormula(categories)
  return {
    categories,
    directTotal,
    dedupeNotes,
    sources,
    directKeys,
    formula,
    commercialKeys: FINANCIAL_ITEM_ORDER.filter(id => ['contingency', 'overheads', 'profit'].includes(id)),
  }
}
