import { findProfileItem } from './priceStore.js'
import { findMarketPrice, MATERIAL_MARKET_CATALOG } from '../data/materialMarketCatalog.js'
import { PRICING_SOURCE_MODES, PRICE_ITEM_SOURCES } from './priceProfileTypes.js'

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
  LIVE: 'live',
  ASSUMPTION: 'assumption',
  PENDING: 'pending',
  PROVISIONAL: 'provisional',
  MANUAL: 'manual',
}

export const PRESENTATION_STYLES = {
  PREMIUM: 'premium',
  DETAILED: 'detailed',
}

export const WORKFLOW_PHASES = {
  MEASUREMENT: 'measurement',
  PRICING_SOURCE: 'pricing_source',
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

export function resolveRowPrice(row, {
  savedPrices = [],
  marketCatalog = MATERIAL_MARKET_CATALOG,
  livePrices = [],
  pricingMode = PRICING_SOURCE_MODES.PROFILE,
  profileName = '',
  allowAssumptions = false,
} = {}) {
  if (row.supplyType === SUPPLY_TYPES.CLIENT || row.clientSupplied) {
    return auditResult('0', PRICE_SOURCES.USER, { userConfirmed: true, notes: 'Client-supplied' })
  }
  if (row.priceSource === PRICE_SOURCES.USER && parseRate(row.rate)) {
    return auditResult(row.rate, PRICE_SOURCES.USER, { userConfirmed: true, notes: row.rateNotes })
  }
  if (pricingMode === PRICING_SOURCE_MODES.MANUAL) {
    return auditResult(row.rate || '', row.rate ? PRICE_SOURCES.MANUAL : PRICE_SOURCES.PENDING, { userConfirmed: Boolean(row.rate) })
  }

  const saved = findProfileItem(savedPrices, { material: row.desc, specification: row.specification, unit: row.unit })
  const market = findMarketPrice(marketCatalog, { material: row.desc, specification: row.specification })
    || livePrices.find(lp => findProfileItem([{ material: lp.materialName, specification: lp.specification }], { material: row.desc, specification: row.specification }))
  const liveRate = market?.price ? String(market.price) : ''

  if (pricingMode === PRICING_SOURCE_MODES.PROFILE) {
    if (saved?.price && parseRate(saved.price)) {
      return auditResult(saved.price, PRICE_SOURCES.PROFILE, {
        profileName,
        supplier: saved.supplier,
        supplierUrl: saved.supplierUrl,
        lastUpdated: saved.lastUpdated,
        userConfirmed: !row.priceLocked,
      })
    }
    return auditResult('', PRICE_SOURCES.PENDING, { notes: 'Rate to be confirmed — not in profile' })
  }

  if (pricingMode === PRICING_SOURCE_MODES.LIVE) {
    if (liveRate && parseRate(liveRate)) {
      return auditResult(liveRate, PRICE_SOURCES.LIVE, {
        supplier: market?.supplier,
        supplierUrl: market?.supplierUrl,
        lastUpdated: market?.checkedAt?.slice?.(0, 10),
        userConfirmed: false,
      })
    }
    return auditResult('', PRICE_SOURCES.PENDING, { notes: 'Rate to be confirmed — no live price found' })
  }

  if (pricingMode === PRICING_SOURCE_MODES.COMPARE) {
    return {
      rate: row.rate || saved?.price || liveRate || '',
      source: row.priceSource || (saved?.price ? PRICE_SOURCES.PROFILE : liveRate ? PRICE_SOURCES.LIVE : PRICE_SOURCES.PENDING),
      confirmed: Boolean(row.priceConfirmed),
      profileRate: saved?.price || '',
      liveRate: liveRate || '',
      profileName,
      supplier: market?.supplier || saved?.supplier,
      supplierUrl: market?.supplierUrl || saved?.supplierUrl,
      lastUpdated: saved?.lastUpdated || market?.checkedAt?.slice?.(0, 10),
      needsCompare: Boolean(saved?.price && liveRate && Math.abs(parseRate(saved.price) - parseRate(liveRate)) > 0.01),
    }
  }

  // Default fallback (profile then market, never invent)
  if (saved?.price && parseRate(saved.price)) {
    return auditResult(saved.price, PRICE_SOURCES.PROFILE, { profileName, supplier: saved.supplier, lastUpdated: saved.lastUpdated })
  }
  if (liveRate && parseRate(liveRate)) {
    return auditResult(liveRate, PRICE_SOURCES.MARKET, { supplier: market?.supplier, userConfirmed: false })
  }
  if (allowAssumptions && row.priceSource === PRICE_SOURCES.ASSUMPTION && parseRate(row.rate)) {
    return auditResult(row.rate, PRICE_SOURCES.ASSUMPTION, { userConfirmed: false })
  }
  return auditResult(row.rate || '', PRICE_SOURCES.PENDING, { notes: 'Rate to be confirmed' })
}

function auditResult(rate, source, extra = {}) {
  return {
    rate: String(rate),
    source,
    confirmed: Boolean(extra.userConfirmed),
    profileName: extra.profileName || '',
    supplier: extra.supplier || '',
    supplierUrl: extra.supplierUrl || '',
    lastUpdated: extra.lastUpdated || '',
    notes: extra.notes || '',
    usedAt: new Date().toISOString(),
    userConfirmed: Boolean(extra.userConfirmed),
  }
}

export function buildPriceConflicts(rows = [], { savedPrices = [], livePrices = [], marketCatalog = MATERIAL_MARKET_CATALOG } = {}) {
  const conflicts = []
  const seen = new Set()
  for (const row of rows) {
    if (!rowNeedsPrice(row)) continue
    const key = `${row.desc}|${row.specification}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const saved = findProfileItem(savedPrices, { material: row.desc, specification: row.specification, unit: row.unit })
    const market = findMarketPrice(marketCatalog, { material: row.desc, specification: row.specification })
      || livePrices.find(lp => lp.materialName && row.desc?.toLowerCase().includes(lp.materialName.toLowerCase().slice(0, 8)))
    const profileRate = parseRate(saved?.price)
    const liveRate = parseRate(market?.price)
    if (!profileRate || !liveRate) continue
    if (Math.abs(profileRate - liveRate) < 0.01) continue
    conflicts.push({
      id: `conflict-${row.id}`,
      rowId: row.id,
      material: row.desc,
      specification: row.specification || '',
      profileRate: saved.price,
      profileUnit: saved.unit || row.unit,
      profileUpdated: saved.lastUpdated,
      liveRate: String(market.price),
      liveUnit: market.unit || row.unit,
      liveSupplier: market.supplier || '',
      liveSupplierUrl: market.supplierUrl || '',
      difference: Math.round((liveRate - profileRate) * 100) / 100,
    })
  }
  return conflicts
}

export function applyConflictChoices(rows = [], resolved = []) {
  const byRow = new Map(resolved.map(r => [r.rowId, r]))
  return rows.map(row => {
    const c = byRow.get(row.id)
    if (!c) return row
    const choice = c.choice
    if (choice === 'profile') {
      return applyAuditToRow(row, c.profileRate, PRICE_SOURCES.PROFILE, { profileName: 'Profile', userConfirmed: true })
    }
    if (choice === 'live') {
      return applyAuditToRow(row, c.liveRate, PRICE_SOURCES.LIVE, { supplier: c.liveSupplier, supplierUrl: c.liveSupplierUrl, userConfirmed: true })
    }
    if (choice === 'provisional') {
      return { ...row, supplyType: SUPPLY_TYPES.PROVISIONAL, rate: '', amount: '', priceSource: PRICE_SOURCES.PROVISIONAL, rateNotes: 'Provisional — rate to be confirmed' }
    }
    return { ...row, priceSource: PRICE_SOURCES.MANUAL, priceConfirmed: false, rateNotes: 'Manual override required' }
  })
}

function applyAuditToRow(row, rate, source, audit = {}) {
  const qty = parseFloat(row.qty) || 0
  const r = String(rate)
  const amount = r && qty ? String(Math.round(qty * parseFloat(r) * 100) / 100) : row.amount
  return {
    ...row,
    rate: r,
    amount,
    priceSource: source,
    priceConfirmed: audit.userConfirmed !== false,
    rateSourceDetail: audit.profileName || audit.supplier || '',
    supplierUrl: audit.supplierUrl || row.supplierUrl,
    rateUsedAt: new Date().toISOString(),
    rateNotes: audit.notes || '',
  }
}

export function identifyMissingMaterialPrices(rows = [], savedPrices = [], marketCatalog = MATERIAL_MARKET_CATALOG, {
  pricingMode = PRICING_SOURCE_MODES.PROFILE,
  livePrices = [],
  profileName = '',
} = {}) {
  const requests = []
  const seen = new Set()

  for (const row of rows) {
    if (!rowNeedsPrice(row)) continue
    const key = inferMaterialKey(row.desc) || row.desc?.slice(0, 40) || `row-${row.id}`
    if (seen.has(key)) continue
    seen.add(key)

    const template = MATERIAL_PRICE_TEMPLATES.find(t => t.key === key)
    const resolved = resolveRowPrice(row, { savedPrices, marketCatalog, livePrices, pricingMode, profileName })

    requests.push({
      id: `price-${row.id}`,
      rowId: row.id,
      material: template?.label || row.desc || 'Material',
      specification: row.specification || template?.spec || '',
      unit: row.unit || template?.unit || 'nr',
      unitPrice: resolved.rate || '',
      supplier: resolved.supplier || '',
      supplyType: row.supplyType || SUPPLY_TYPES.CONTRACTOR,
      priceSource: resolved.source || PRICE_SOURCES.PENDING,
      status: resolved.rate ? 'suggested' : 'required',
      marketStatus: resolved.rate ? 'available' : 'manual_entry_required',
      rateNotes: resolved.notes || (resolved.rate ? '' : 'Rate to be confirmed'),
      profileRate: resolved.profileRate || '',
      liveRate: resolved.liveRate || '',
      rateSourceDetail: resolved.profileName || resolved.supplier || '',
    })
  }
  return requests
}

export function applyPriceInputsToRows(rows = [], priceInputs = [], { profileName = '' } = {}) {
  const byRow = new Map(priceInputs.map(p => [p.rowId, p]))
  const now = new Date().toISOString()
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
      priceSource: input.priceSource || (rate ? PRICE_SOURCES.USER : PRICE_SOURCES.PENDING),
      priceConfirmed: Boolean(rate && input.status !== 'required'),
      clientSupplied: input.supplyType === SUPPLY_TYPES.CLIENT,
      rateSourceDetail: input.rateSourceDetail || profileName || input.supplier || '',
      supplierUrl: input.supplierUrl || row.supplierUrl || '',
      rateUsedAt: now,
      rateNotes: input.rateNotes || input.notes || (rate ? '' : 'Rate to be confirmed'),
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
  if (/###\s*QS\s+WORKFLOW[^]*PHASE\s*5|FINAL\s+REVIEW|READY\s+FOR\s+EXPORT/i.test(text)) return WORKFLOW_PHASES.REVIEW
  if (/###\s*QS\s+WORKFLOW[^]*PHASE\s*4|PRICED\s+BOQ/i.test(text)) return WORKFLOW_PHASES.REVIEW
  if (/###\s*QS\s+WORKFLOW[^]*PHASE\s*3|MATERIAL\s+PRICE\s+COLLECTION|MATERIAL\s+PRICES\s+REQUIRED/i.test(text)) return WORKFLOW_PHASES.PRICE_COLLECTION
  if (/###\s*QS\s+WORKFLOW[^]*PHASE\s*2|PRICING\s+SOURCE|WHICH\s+PRICING\s+SOURCE/i.test(text)) return WORKFLOW_PHASES.PRICING_SOURCE
  if (/###\s*QS\s+WORKFLOW[^]*PHASE\s*1|MEASUREMENT|TAKEOFF/i.test(text)) return WORKFLOW_PHASES.MEASUREMENT
  if (/PRICE\s+COLLECTION|MATERIAL\s+PRICES\s+REQUIRED|USER\s+PRICES\s+REQUIRED/i.test(text)) return WORKFLOW_PHASES.PRICE_COLLECTION
  if (/PRICING\s+SOURCE|USE\s+SAVED\s+PRICE\s+PROFILE/i.test(text)) return WORKFLOW_PHASES.PRICING_SOURCE
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
