import { findSavedPrice } from './priceStore.js'
import { findMarketPrice, MATERIAL_MARKET_CATALOG } from '../data/materialMarketCatalog.js'

export const SUPPLY_TYPES = {
  CONTRACTOR: 'contractor-supplied',
  CLIENT: 'client-supplied',
  OPTIONAL: 'optional',
  PROVISIONAL: 'provisional',
  EXCLUDED: 'excluded',
}

export const PRICE_SOURCES = {
  USER: 'user',
  PROFILE: 'profile',
  MARKET: 'market',
  ASSUMPTION: 'assumption',
  PENDING: 'pending',
}

export const PRESENTATION_STYLES = {
  PREMIUM: 'premium',
  DETAILED: 'detailed',
}

export const WORKFLOW_PHASES = {
  MEASUREMENT: 'measurement',
  PRICE_COLLECTION: 'price_collection',
  CLARIFICATION: 'clarification',
  REVIEW: 'review',
  EXPORT: 'export',
}

/** Material templates the AI/QS workflow should ask about explicitly. */
export const MATERIAL_PRICE_TEMPLATES = [
  { key: 'cement-42.5R', label: 'Cement 42.5R', unit: 'bag', spec: '50kg bag' },
  { key: 'cement-32.5R', label: 'Cement 32.5R', unit: 'bag', spec: '50kg bag' },
  { key: 'blocks', label: 'Blocks', unit: 'nr', spec: 'Size/type required' },
  { key: 'tiles', label: 'Tiles', unit: 'm²', spec: 'Size, type, price per m² or per box, coverage/box' },
  { key: 'paint', label: 'Paint', unit: 'bucket', spec: 'Bucket size, coverage, brand/type' },
  { key: 'sand', label: 'Sand', unit: 'm³', spec: 'Trip, m³, or truckload' },
  { key: 'chippings', label: 'Chippings', unit: 'm³', spec: 'Trip, m³, or truckload' },
  { key: 'rebar', label: 'Reinforcement', unit: 'kg', spec: 'Bar size and price' },
  { key: 'plumbing', label: 'Plumbing', unit: 'ls', spec: 'First fix / second fix / client-supplied' },
  { key: 'electrical', label: 'Electrical', unit: 'ls', spec: 'First fix / second fix / client-supplied' },
]

const MATERIAL_RX = [
  { rx: /cement|42\.5|32\.5/i, template: 'cement-42.5R' },
  { rx: /block|sandcrete/i, template: 'blocks' },
  { rx: /tile/i, template: 'tiles' },
  { rx: /paint|emulsion/i, template: 'paint' },
  { rx: /\bsand\b/i, template: 'sand' },
  { rx: /chipping|aggregate/i, template: 'chippings' },
  { rx: /rebar|reinforc|y\d+/i, template: 'rebar' },
  { rx: /plumb|pipe|sanitary/i, template: 'plumbing' },
  { rx: /electr|cable|conduit/i, template: 'electrical' },
]

function inferMaterialKey(desc = '') {
  for (const { rx, template } of MATERIAL_RX) {
    if (rx.test(desc)) return template
  }
  return null
}

function parseRate(rate) {
  const n = parseFloat(String(rate ?? '').replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

function rowNeedsPrice(row) {
  if (!row || row.supplyType === SUPPLY_TYPES.EXCLUDED) return false
  if (row.supplyType === SUPPLY_TYPES.CLIENT || row.clientSupplied) return false
  if (row.supplyType === SUPPLY_TYPES.PROVISIONAL && !row.rate) return true
  return !parseRate(row.rate)
}

export function resolveRowPrice(row, { savedPrices = [], marketCatalog = MATERIAL_MARKET_CATALOG, allowAssumptions = false } = {}) {
  if (row.supplyType === SUPPLY_TYPES.CLIENT || row.clientSupplied) {
    return { rate: '0', source: PRICE_SOURCES.USER, confirmed: true }
  }
  if (row.priceSource === PRICE_SOURCES.USER && parseRate(row.rate)) {
    return { rate: row.rate, source: PRICE_SOURCES.USER, confirmed: true }
  }
  const saved = findSavedPrice(savedPrices, { material: row.desc, specification: row.specification, unit: row.unit })
  if (saved?.price && parseRate(saved.price)) {
    return { rate: saved.price, source: PRICE_SOURCES.PROFILE, confirmed: !row.priceLocked }
  }
  const market = findMarketPrice(marketCatalog, { material: row.desc, specification: row.specification })
  if (market?.price && parseRate(market.price)) {
    return { rate: String(market.price), source: PRICE_SOURCES.MARKET, confirmed: false }
  }
  if (allowAssumptions && row.priceSource === PRICE_SOURCES.ASSUMPTION && parseRate(row.rate)) {
    return { rate: row.rate, source: PRICE_SOURCES.ASSUMPTION, confirmed: false }
  }
  return { rate: row.rate || '', source: PRICE_SOURCES.PENDING, confirmed: false }
}

export function identifyMissingMaterialPrices(rows = [], savedPrices = [], marketCatalog = MATERIAL_MARKET_CATALOG) {
  const requests = []
  const seen = new Set()

  for (const row of rows) {
    if (!rowNeedsPrice(row)) continue
    const key = inferMaterialKey(row.desc) || row.desc?.slice(0, 40) || `row-${row.id}`
    if (seen.has(key)) continue
    seen.add(key)

    const template = MATERIAL_PRICE_TEMPLATES.find(t => t.key === key)
    const saved = findSavedPrice(savedPrices, { material: row.desc, specification: row.specification, unit: row.unit })
    const market = findMarketPrice(marketCatalog, { material: row.desc, specification: row.specification })

    requests.push({
      id: `price-${row.id}`,
      rowId: row.id,
      material: template?.label || row.desc || 'Material',
      specification: row.specification || template?.spec || '',
      unit: row.unit || template?.unit || 'nr',
      unitPrice: saved?.price || (market?.status === 'live' ? market.price : '') || '',
      supplier: saved?.supplier || market?.supplier || '',
      supplyType: row.supplyType || SUPPLY_TYPES.CONTRACTOR,
      priceSource: saved?.price ? PRICE_SOURCES.PROFILE : (market?.price ? PRICE_SOURCES.MARKET : PRICE_SOURCES.PENDING),
      status: saved?.price || market?.price ? 'suggested' : 'required',
      marketStatus: market?.status || 'manual_entry_required',
    })
  }
  return requests
}

export function applyPriceInputsToRows(rows = [], priceInputs = []) {
  const byRow = new Map(priceInputs.map(p => [p.rowId, p]))
  return rows.map(row => {
    const input = byRow.get(row.id)
    if (!input) return row
    const rate = String(input.unitPrice ?? '').trim()
    const qty = parseFloat(row.qty) || 0
    const amount = rate && qty ? String(Math.round(qty * parseFloat(rate) * 100) / 100) : row.amount
    return {
      ...row,
      rate,
      amount,
      unit: input.unit || row.unit,
      specification: input.specification || row.specification,
      supplier: input.supplier || row.supplier,
      supplyType: input.supplyType || row.supplyType,
      priceSource: PRICE_SOURCES.USER,
      priceConfirmed: Boolean(rate),
      clientSupplied: input.supplyType === SUPPLY_TYPES.CLIENT,
    }
  })
}

export function buildClarificationPacket(data = {}) {
  const rows = data.boqItems || data.boqRows || []
  const measured = rows.filter(r => parseFloat(r.qty) > 0 && r.supplyType !== SUPPLY_TYPES.EXCLUDED)
  const missingPrices = identifyMissingMaterialPrices(rows)
  const assumptions = data.assumptions || []
  const exclusions = data.exclusions || []
  const provisional = data.provisional || []
  const clientSupplied = rows.filter(r => r.clientSupplied || r.supplyType === SUPPLY_TYPES.CLIENT)
  const optional = rows.filter(r => r.supplyType === SUPPLY_TYPES.OPTIONAL)
  const excluded = rows.filter(r => r.supplyType === SUPPLY_TYPES.EXCLUDED)
  const takeoff = data.drawingAnalysis?.takeoffNotes || data.takeoffNotes || ''

  return {
    measuredQuantities: measured,
    missingInformation: missingPrices.filter(p => p.status === 'required'),
    assumptions,
    exclusions,
    provisionalItems: provisional.length ? provisional : rows.filter(r => r.supplyType === SUPPLY_TYPES.PROVISIONAL).map(r => r.desc),
    optionalItems: optional,
    excludedItems: excluded,
    clientSuppliedItems: clientSupplied,
    itemsRequiringPrices: missingPrices,
    takeoffNotes: takeoff,
    highRiskAssumptions: assumptions.filter(a => /assume|estimate|typical|standard market|provisional|pc sum/i.test(a)),
  }
}

export function validatePreExport(data = {}, { presentationStyle } = {}) {
  const rows = data.boqItems || data.boqRows || []
  const packet = buildClarificationPacket(data)
  const missingPrices = rows.filter(rowNeedsPrice)
  const unconfirmedMarket = rows.filter(r => r.priceSource === PRICE_SOURCES.MARKET && !r.priceConfirmed)
  const assumptions = packet.highRiskAssumptions

  const blockers = []
  if (missingPrices.length) blockers.push(`${missingPrices.length} line item(s) still need unit rates`)
  if (!presentationStyle) blockers.push('Document presentation style not selected')

  return {
    ok: blockers.length === 0,
    blockers,
    warnings: [
      unconfirmedMarket.length ? `${unconfirmedMarket.length} market price(s) not confirmed by user` : null,
      assumptions.length ? `${assumptions.length} high-risk assumption(s) flagged` : null,
      packet.provisionalItems.length ? `${packet.provisionalItems.length} provisional item(s)` : null,
      packet.optionalItems.length ? `${packet.optionalItems.length} optional item(s)` : null,
    ].filter(Boolean),
    missingPrices,
    provisionalItems: packet.provisionalItems,
    optionalItems: packet.optionalItems,
    highRiskAssumptions: assumptions,
    finalTotal: data.pricing?.layers?.finalEstimate || data.contractSum || 0,
    presentationStyle,
  }
}

export function groupRowsForPremiumQuotation(rows = []) {
  const groups = new Map()
  for (const row of rows) {
    if (row.supplyType === SUPPLY_TYPES.EXCLUDED) continue
    const section = row.section || 'General'
    if (!groups.has(section)) groups.set(section, { section, items: [], subtotal: 0 })
    const g = groups.get(section)
    g.items.push(row)
    g.subtotal += parseFloat(row.amount) || 0
  }
  return [...groups.values()].map(g => ({
    ...g,
    subtotal: Math.round(g.subtotal * 100) / 100,
    summaryDesc: `${g.items.length} item(s) — ${g.section}`,
  }))
}

export function applyPresentationStyle(payload = {}, style = PRESENTATION_STYLES.DETAILED) {
  const rows = payload.boqRows || []
  if (style === PRESENTATION_STYLES.PREMIUM) {
    return {
      ...payload,
      presentationStyle: style,
      boqCategorySummaries: groupRowsForPremiumQuotation(rows),
      boqRows: rows.map(r => ({
        ...r,
        hideInPremium: /detail|fixing|labour|waste|allowance/i.test(r.desc) && !r.section?.includes('Prelim'),
      })),
    }
  }
  return {
    ...payload,
    presentationStyle: style,
    boqCategorySummaries: null,
    boqRows: rows.map(r => ({ ...r, hideInPremium: false })),
  }
}

export function buildWorkflowDocPayload(intelligenceData, {
  docType = 'boq',
  source = 'qs-workflow',
  presentationStyle = PRESENTATION_STYLES.DETAILED,
  priceInputs = [],
  workflowMeta = {},
} = {}) {
  const rows = applyPriceInputsToRows(intelligenceData.boqItems || [], priceInputs)
  const enriched = {
    ...intelligenceData,
    boqItems: rows,
    workflow: {
      approvedAt: new Date().toISOString(),
      presentationStyle,
      ...workflowMeta,
    },
  }

  return applyPresentationStyle({
    version: 2,
    source,
    docType,
    transferredAt: new Date().toISOString(),
    meta: {
      quoteNum: enriched.projectInfo?.quoteNum || '',
      date: enriched.projectInfo?.date || '',
      validDays: enriched.projectInfo?.validDays || '30',
      clientName: enriched.client?.name || '',
      clientContact: enriched.client?.contact || '',
      clientEmail: enriched.client?.email || '',
      projectLocation: enriched.projectInfo?.location || '',
      projectTitle: enriched.projectInfo?.title || 'Construction Project',
      projectDescription: enriched.projectInfo?.description || '',
      notes: enriched.projectInfo?.notes || '',
      paymentTerms: enriched.projectInfo?.paymentTerms || null,
    },
    boqRows: rows,
    matCategories: enriched.matCategories || [],
    materials: enriched.materials || [],
    labor: enriched.labor || [],
    prelims: enriched.pricing?.prelimsForDoc || [],
    assumptions: enriched.assumptions || [],
    exclusions: enriched.exclusions || [],
    provisional: enriched.provisional || [],
    optionalItems: rows.filter(r => r.supplyType === SUPPLY_TYPES.OPTIONAL),
    clientSuppliedItems: rows.filter(r => r.clientSupplied || r.supplyType === SUPPLY_TYPES.CLIENT),
    drawingAnalysis: enriched.drawingAnalysis || {},
    collections: enriched.collections || [],
    pricing: enriched.pricing,
    financialAdjustments: enriched.financialAdjustments,
    contractSum: enriched.pricing?.layers?.finalEstimate || 0,
    totals: enriched.pricing?.summary,
    workflow: enriched.workflow,
    presentationStyle,
  }, presentationStyle)
}

export function detectWorkflowPhaseFromText(text = '') {
  if (/###\s*QS\s+WORKFLOW[^]*PHASE\s*4|FINAL\s+REVIEW|READY\s+FOR\s+EXPORT/i.test(text)) return WORKFLOW_PHASES.REVIEW
  if (/###\s*QS\s+WORKFLOW[^]*PHASE\s*3|PRICE\s+COLLECTION|MATERIAL\s+PRICES\s+REQUIRED/i.test(text)) return WORKFLOW_PHASES.PRICE_COLLECTION
  if (/###\s*QS\s+WORKFLOW[^]*PHASE\s*2|CLARIFICATION|MISSING\s+INFORMATION/i.test(text)) return WORKFLOW_PHASES.CLARIFICATION
  if (/###\s*QS\s+WORKFLOW[^]*PHASE\s*1|MEASUREMENT|TAKEOFF/i.test(text)) return WORKFLOW_PHASES.MEASUREMENT
  if (/PRICE\s+COLLECTION|MATERIAL\s+PRICES\s+REQUIRED|USER\s+PRICES\s+REQUIRED/i.test(text)) return WORKFLOW_PHASES.PRICE_COLLECTION
  return null
}

export function shouldHoldAutoMerge(extract) {
  if (!extract) return false
  if (extract.workflowPhase && extract.workflowPhase !== WORKFLOW_PHASES.REVIEW) return true
  const rows = extract.boqRows || []
  if (!rows.length) return false
  const missing = rows.filter(rowNeedsPrice)
  const assumed = rows.filter(r => r.priceSource === PRICE_SOURCES.ASSUMPTION || (!r.priceConfirmed && parseRate(r.rate)))
  return missing.length > 0 || (assumed.length > 0 && !extract.userApprovedPricing)
}
