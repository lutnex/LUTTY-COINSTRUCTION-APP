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

export const DIRECT_COST_ONLY_KEYS = [
  'materials',
  'labour',
  'earthworks',
  'filling',
  'transport',
  'preliminaries',
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

const ORIGIN_LABELS = {
  'materials-array': 'Material Schedule',
  'labor-array': 'Labour Schedule',
  'prelims-array': 'Preliminaries List',
  'equipment-array': 'Equipment Schedule',
  boq: 'BOQ',
  none: 'None',
  excluded: 'Excluded (duplicate)',
}

const TOLERANCE = 0.02

function rowAmount(row, { excludeClientSupply = true } = {}) {
  if (!row) return 0
  if (excludeClientSupply && (row.clientSupplied || row.clientSupply)) return 0
  return parseFloat(row.amount) || 0
}

function sumRows(rows = [], opts = {}) {
  return rows.reduce((s, r) => s + rowAmount(r, opts), 0)
}

/** Stable fingerprint for matching schedule rows to BOQ duplicates. */
export function rowFingerprint(row = {}) {
  const desc = String(row.desc || row.material || row.trade || '').trim().toLowerCase()
  const qty = String(row.qty ?? row.quantity ?? '').trim()
  const rate = String(row.rate ?? row.unitRate ?? '').trim()
  const amt = String(parseFloat(row.amount) || 0)
  return `${desc}|${qty}|${rate}|${amt}`
}

function buildFingerprintSet(rows = []) {
  const set = new Set()
  for (const row of rows) set.add(rowFingerprint(row))
  return set
}

/** Classify a BOQ row into a direct-cost category. */
export function classifyBoqRow(row = {}) {
  const section = String(row.section || '').toLowerCase()
  const desc = String(row.desc || '').toLowerCase()
  const text = `${section} ${desc}`

  if (/labou?r/.test(section) || /labou?r/.test(desc)) return 'labour'
  if (/^materials?\b|material\s*(works|schedule|breakdown)?/.test(section)) return 'materials'
  if (row.material || row.matCategory || row.category) return 'materials'
  if (/preliminar/.test(section) || /preliminar/.test(desc)) return 'preliminaries'
  if (/earth\s*works|excavation|cutting|bulk\s*exc/.test(text)) return 'earthworks'
  if (/filling|backfill|compaction/.test(text)) return 'filling'
  if (/transport|haulage|delivery|cartage/.test(text)) return 'transport'
  if (/equipment|plant|machinery|hire/.test(text)) return 'equipment'
  return 'other'
}

function isMaterialScheduleRow(row, materialFingerprints) {
  if (!row) return false
  if (String(row.source || '').includes('ai-material')) return true
  if (row.material || row.matCategory) return true
  if (materialFingerprints.has(rowFingerprint(row))) return true
  return false
}

function isLaborScheduleRow(row, laborFingerprints) {
  if (!row) return false
  if (String(row.source || '').includes('ai-labor')) return true
  if (laborFingerprints.has(rowFingerprint(row))) return true
  return false
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

function transportTotal(categories) {
  return (categories.transport || 0) + (categories.equipment || 0)
}

/** Direct Cost Only = Materials + Labour + Earthworks + Filling + Transport + Preliminaries */
export function computeDirectCostOnlyTotal(categories = {}) {
  return DIRECT_COST_ONLY_KEYS.reduce((sum, key) => {
    if (key === 'transport') return sum + transportTotal(categories)
    return sum + (categories[key] || 0)
  }, 0)
}

function formatOrigin(sourceKey) {
  return ORIGIN_LABELS[sourceKey] || sourceKey || ORIGIN_LABELS.none
}

/** Build per-category audit rows: Source | Value | Origin */
export function buildCalculationAudit(categories = {}, categorySources = {}) {
  const rows = DIRECT_COST_ONLY_KEYS.map(key => ({
    category: key,
    label: BREAKDOWN_LABELS[key],
    value: key === 'transport' ? transportTotal(categories) : (categories[key] || 0),
    origin: formatOrigin(categorySources[key] || (categories[key] > 0 ? 'boq' : 'none')),
  }))

  rows.push({
    category: 'equipment',
    label: BREAKDOWN_LABELS.equipment,
    value: categories.equipment || 0,
    origin: categories.equipment > 0
      ? formatOrigin(categorySources.equipment || 'equipment-array')
      : ORIGIN_LABELS.none,
    note: categories.equipment > 0 ? 'Included in Transport for Direct Cost Only' : undefined,
  })

  rows.push({
    category: 'other',
    label: BREAKDOWN_LABELS.other,
    value: categories.other || 0,
    origin: categories.other > 0
      ? formatOrigin(categorySources.other || 'boq')
      : ORIGIN_LABELS.none,
  })

  return rows
}

function validateCategories(categories, { hasMaterialsArray, hasLaborArray }, warnings) {
  if (
    categories.materials > 0
    && Math.abs(categories.other - categories.materials) < TOLERANCE
  ) {
    categories.other = 0
    warnings.push('Possible duplicate material import detected.')
  }

  if (hasMaterialsArray && categories.other > 0 && categories.materials > 0) {
    const combined = categories.materials + categories.other
    if (Math.abs(categories.other - categories.materials) < TOLERANCE) {
      categories.other = 0
      if (!warnings.some(w => w.includes('duplicate material'))) {
        warnings.push('Possible duplicate material import detected.')
      }
    }
  }

  if (hasLaborArray && categories.other > 0 && Math.abs(categories.other - categories.labour) < TOLERANCE) {
    categories.other = 0
    warnings.push('Possible duplicate labour import detected.')
  }

  if (!hasMaterialsArray && !hasLaborArray && categories.other === 0) {
    // no-op — genuine zero
  }
}

/**
 * Compute deduped direct-cost breakdown.
 * @returns {{ categories, directTotal, dedupeNotes, sources, warnings, auditLog }}
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
  const warnings = []
  const categorySources = {}
  const skippedRows = []

  const hasMaterialsArray = materials.length > 0
  const hasLaborArray = labor.length > 0
  const hasPrelimsArray = (prelims || []).filter(p => !p.isFinancialAdjustment).length > 0
  const hasEquipArray = equipment.length > 0

  const materialFingerprints = buildFingerprintSet(materials)
  const laborFingerprints = buildFingerprintSet(labor)

  const skipFromBoq = new Set()
  if (hasLaborArray) {
    skipFromBoq.add('labour')
    dedupeNotes.push('Labour taken from labour schedule (excluded from BOQ labour rows)')
  }
  if (hasMaterialsArray) {
    skipFromBoq.add('materials')
    dedupeNotes.push('Materials taken from material schedule (excluded from BOQ material rows)')
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
    const amt = rowAmount(row)
    if (amt <= 0) continue

    if (hasMaterialsArray && isMaterialScheduleRow(row, materialFingerprints)) {
      skippedRows.push({ row, reason: 'material-schedule-duplicate' })
      continue
    }

    if (hasLaborArray && isLaborScheduleRow(row, laborFingerprints)) {
      skippedRows.push({ row, reason: 'labor-schedule-duplicate' })
      continue
    }

    const cat = classifyBoqRow(row)

    if (hasMaterialsArray && cat === 'other') {
      skippedRows.push({ row, reason: 'other-blocked-material-schedule' })
      continue
    }

    if (skipFromBoq.has(cat)) continue

    categories[cat] = (categories[cat] || 0) + amt
    categorySources[cat] = categorySources[cat] || 'boq'
  }

  if (hasMaterialsArray) {
    categories.materials += sumRows(materials)
    categorySources.materials = 'materials-array'
  } else if (!boqRows.length && materials.length) {
    categories.materials += sumRows(materials)
    categorySources.materials = 'materials-array'
  }

  if (hasLaborArray) {
    categories.labour += sumRows(labor, { excludeClientSupply: false })
    categorySources.labour = 'labor-array'
  }

  if (hasPrelimsArray) {
    const directPrelims = prelims.filter(p => !p.isFinancialAdjustment)
    categories.preliminaries += directPrelims.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
    categorySources.preliminaries = 'prelims-array'
  }

  if (hasEquipArray) {
    const equipSum = sumRows(equipment, { excludeClientSupply: false })
    categories.equipment += equipSum
    categorySources.equipment = 'equipment-array'
    if (equipSum > 0 && !categorySources.transport) {
      categorySources.transport = 'equipment-array'
    }
  }

  validateCategories(categories, { hasMaterialsArray, hasLaborArray }, warnings)

  if (!hasMaterialsArray && categories.other > 0) {
    categories.materials += categories.other
    categorySources.materials = categorySources.materials || 'boq'
    categories.other = 0
  }

  if (skippedRows.length > 0) {
    const materialSkips = skippedRows.filter(s => s.reason === 'material-schedule-duplicate').length
    const otherSkips = skippedRows.filter(s => s.reason === 'other-blocked-material-schedule').length
    if (materialSkips > 0) {
      dedupeNotes.push(`${materialSkips} material schedule row(s) excluded from BOQ to prevent double-counting`)
    }
    if (otherSkips > 0) {
      dedupeNotes.push(`${otherSkips} BOQ row(s) blocked from Other — material schedule is the source of truth`)
    }
  }

  const directTotal = computeDirectCostOnlyTotal(categories)
  const auditLog = buildCalculationAudit(categories, categorySources)

  return {
    categories,
    directTotal,
    dedupeNotes,
    sources: categorySources,
    directKeys: DIRECT_COST_ONLY_KEYS,
    warnings,
    auditLog,
    skippedRows,
  }
}

export function buildDirectCostFormula(categories = {}) {
  const transport = transportTotal(categories)
  const parts = [
    ['materials', categories.materials || 0],
    ['labour', categories.labour || 0],
    ['earthworks', categories.earthworks || 0],
    ['filling', categories.filling || 0],
    ['transport', transport],
    ['preliminaries', categories.preliminaries || 0],
  ]
  const expression = `Direct Cost = ${parts.map(([k]) => BREAKDOWN_LABELS[k]).join(' + ')}`
  const total = parts.reduce((s, [, v]) => s + v, 0)
  return { expression, parts: parts.map(([k]) => k), total }
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
  const categories = emptyCategories()
  return {
    categories,
    directTotal: 0,
    dedupeNotes: [],
    sources: {},
    directKeys: DIRECT_COST_ONLY_KEYS,
    warnings: [],
    auditLog: buildCalculationAudit(categories, {}),
    formula: buildDirectCostFormula(categories),
  }
}

export function buildApprovalBreakdown(input = {}) {
  const result = computeDirectCostBreakdown(input)
  const formula = buildDirectCostFormula(result.categories)
  return {
    ...result,
    formula,
    commercialKeys: FINANCIAL_ITEM_ORDER.filter(id => ['contingency', 'overheads', 'profit'].includes(id)),
  }
}
