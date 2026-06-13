/**
 * parseAIResponse — structured extraction from professional QS BOQ / estimate output.
 */

import { inferMaterialCategory, normalizeMaterialState } from '../../utils/materialCategories.js'
import { detectWorkflowPhaseFromText, PRICE_SOURCES, shouldHoldAutoMerge } from '../../utils/qsWorkflow.js'
import { extractAgreedPricesFromText } from '../../utils/priceExtraction.js'

function parseTableRows(tableBlock, defaultSection = 'General') {
  const rows = []
  const lines = tableBlock.trim().split('\n').filter(Boolean)
  if (!lines.length) return rows

  const headerLine = lines[0]
  const headers = headerLine.split('|').map(h => h.trim().toLowerCase()).filter(Boolean)
  const dataLines = lines.slice(2) // skip header + separator

  const idx = (...keys) => {
    for (const k of keys) {
      const i = headers.findIndex(h => h.includes(k))
      if (i >= 0) return i
    }
    return -1
  }

  const refI = idx('item ref', 'item', 'ref', 'no', '#')
  const secI = idx('section', 'trade', 'bill')
  const descI = idx('desc', 'item', 'work', 'material', 'name', 'description')
  const unitI = idx('unit')
  const qtyI = idx('qty', 'quan')
  const rateI = idx('rate', 'price')
  const amtI = idx('amount', 'total', 'ghs', 'cost')

  if (descI < 0 && headers.length < 2) return rows

  let id = Date.now()
  for (const row of dataLines) {
    const cols = row.split('|').map(c => c.trim()).filter(Boolean)
    if (cols.length < 2) continue
    const get = (i) => (i >= 0 && i < cols.length ? cols[i] : '')
    const desc = get(descI >= 0 ? descI : 1)
    if (!desc || desc.length < 2 || /^[-=]+$/.test(desc)) continue
    if (/^(bill|collection|carried|total|subtotal)/i.test(desc)) continue

    const q = get(qtyI).replace(/[^\d.]/g, '')
    const r = get(rateI).replace(/[^\d.]/g, '')
    const rawAmt = get(amtI).replace(/[^\d.]/g, '')
    const amt = rawAmt || (q && r ? String(Math.round(parseFloat(q) * parseFloat(r) * 100) / 100) : '')

    rows.push({
      id: id++,
      itemRef: get(refI) || '',
      section: inferMaterialCategory(desc, get(secI) || defaultSection),
      desc,
      specification: /\[ASSUMPTION/i.test(desc) ? desc : '',
      unit: get(unitI) || 'nr',
      qty: q,
      rate: r,
      amount: amt,
      clientSupplied: /client|pc sum|prime cost/i.test(row),
      priceSource: r ? (/saved rate|user price|confirmed/i.test(row) ? PRICE_SOURCES.USER : PRICE_SOURCES.ASSUMPTION) : PRICE_SOURCES.PENDING,
      priceConfirmed: /confirmed|user price|saved rate/i.test(row),
    })
  }
  return rows
}

function extractSectionBlocks(text) {
  const assumptions = []
  const exclusions = []
  const provisional = []
  let takeoffNotes = ''

  const takeM = /###?\s*DRAWING[^#\n]*TAKEOFF\s*\n+([\s\S]*?)(?=\n###|$)/i.exec(text)
  if (takeM) takeoffNotes = takeM[1].trim().slice(0, 2000)

  const assM = /###?\s*ASSUMPTIONS\s*\n+([\s\S]*?)(?=\n###|$)/i.exec(text)
  if (assM) {
    assM[1].split('\n').forEach(l => {
      const t = l.replace(/^[-*•\d.]+\s*/, '').trim()
      if (t.length > 5) assumptions.push(t)
    })
  }

  const excM = /###?\s*EXCLUSIONS[^#\n]*\n+([\s\S]*?)(?=\n###|$)/i.exec(text)
  if (excM) {
    excM[1].split('\n').forEach(l => {
      const t = l.replace(/^[-*•\d.]+\s*/, '').trim()
      if (t.length > 5) exclusions.push(t)
    })
  }

  const provM = /###?\s*PROVISIONAL[^#\n]*\n+([\s\S]*?)(?=\n###|$)/i.exec(text)
  if (provM) {
    provM[1].split('\n').forEach(l => {
      const t = l.replace(/^[-*•\d.]+\s*/, '').trim()
      if (t.length > 5) provisional.push(t)
    })
  }

  return { takeoffNotes, assumptions, exclusions, provisional }
}

function extractCollections(text) {
  const collections = []
  const rx = /\*\*Collection\s+Bill\s*(\d+)[^*]*GHS\s*([\d,]+(?:\.\d+)?)\*\*/gi
  let m
  while ((m = rx.exec(text)) !== null) {
    collections.push({ bill: m[1], amount: parseFloat(m[2].replace(/,/g, '')) })
  }
  return collections
}

export function parseAIResponse(text) {
  const boqRows = []
  const materials = []
  const labor = []
  const risks = []
  let contractSum = null
  let projectTitle = null
  let projectScope = null

  if (!text) {
    return emptyResult()
  }

  let currentBill = 'General'

  // Bill headers update section context
  const billRx = /###?\s*BILL\s*(\d+)\s*[—–-]\s*([^\n]+)/gi
  const billPositions = []
  let bm
  while ((bm = billRx.exec(text)) !== null) {
    billPositions.push({ index: bm.index, section: `B${bm[1]} — ${bm[2].trim()}` })
  }

  const tableRx = /\|([^\n]+)\|\n\|[-| :]+\|\n((?:\|[^\n]+\|\n?)*)/g
  let tm
  while ((tm = tableRx.exec(text)) !== null) {
    const tableStart = tm.index
    const header = tm[1].toLowerCase()

    // Section context from nearest preceding bill header
    for (let i = billPositions.length - 1; i >= 0; i--) {
      if (billPositions[i].index < tableStart) {
        currentBill = billPositions[i].section
        break
      }
    }

    const block = `|${tm[1]}|\n| --- |\n${tm[2]}`
    const rows = parseTableRows(block, currentBill)

    if (header.includes('material')) {
      materials.push(...rows)
    } else if (header.includes('labour') || header.includes('labor') || header.includes('trade')) {
      labor.push(...rows)
    } else if (header.includes('risk') && header.includes('rating')) {
      for (const r of rows) {
        const rating = /high/i.test(r.desc + r.section) ? 'HIGH'
          : /low/i.test(r.desc + r.section) ? 'LOW' : 'MEDIUM'
        risks.push({
          id: Date.now() + risks.length,
          risk: r.desc,
          likelihood: 'Medium',
          impact: 'Medium',
          rating,
          mitigation: r.itemRef || 'See BOQ analysis',
        })
      }
    } else {
      boqRows.push(...rows)
    }
  }

  const sumRx = /(?:contract\s+sum|total\s+value|grand\s+total|carried\s+to\s+summary)[^\n]*?GHS\s*([\d,]+(?:\.\d+)?)/gi
  let sm
  while ((sm = sumRx.exec(text)) !== null) {
    const v = parseFloat(sm[1].replace(/,/g, ''))
    if (!isNaN(v) && v > 0) { contractSum = v; break }
  }
  if (!contractSum) {
    const altRx = /GHS\s*([\d,]+(?:\.\d+)?)\s*(?:\n|$)/gi
    const nums = []
    let am
    while ((am = altRx.exec(text)) !== null) {
      const v = parseFloat(am[1].replace(/,/g, ''))
      if (!isNaN(v) && v > 100000) nums.push(v)
    }
    if (nums.length) contractSum = Math.max(...nums)
  }

  const tm2 = /###?\s*PROJECT\s+SUMMARY\s*\n+([^\n]+)/i.exec(text)
  if (tm2) projectTitle = tm2[1].trim()

  const sm2 = /###?\s*SCOPE\s+OF\s+WORKS?\s*\n+([\s\S]{20,400}?)(?=\n###|\n\*\*|$)/i.exec(text)
  if (sm2) projectScope = sm2[1].replace(/[#*]/g, '').trim().slice(0, 400)

  // Risk bullets fallback
  if (risks.length < 3) {
    const riskRx = /(?:high|medium|low)\s+risk[^:\n]*[:\s]+([^\n]{15,})/gi
    let rm
    let rid = Date.now() + 500
    while ((rm = riskRx.exec(text)) !== null) {
      const rating = /high/i.test(rm[0]) ? 'HIGH' : /medium/i.test(rm[0]) ? 'MEDIUM' : 'LOW'
      risks.push({
        id: rid++,
        risk: rm[1].trim().slice(0, 100),
        likelihood: 'Medium',
        impact: 'Medium',
        rating,
        mitigation: 'See BOQ commercial review',
      })
      if (risks.length >= 9) break
    }
  }

  const { takeoffNotes, assumptions, exclusions, provisional } = extractSectionBlocks(text)
  const collections = extractCollections(text)

  const hasEstimate = Boolean(contractSum) || /contract\s+sum|estimate\s+total/i.test(text)
  const hasBOQ = boqRows.length > 2
  const hasRisks = risks.length > 0 || /RISK\s+REGISTER|RISKS\s+AND\s+EXCLUSIONS/i.test(text)
  const confidence = (boqRows.length > 15 && contractSum) ? 'high'
    : (boqRows.length > 5 || contractSum) ? 'medium'
    : 'low'

  if (import.meta.env.DEV) {
    console.log('[BOQ Parser]', {
      boqRows: boqRows.length,
      materials: materials.length,
      labor: labor.length,
      risks: risks.length,
      collections: collections.length,
      assumptions: assumptions.length,
      contractSum,
      confidence,
    })
  }

  const categorized = normalizeMaterialState(
    materials.map(m => ({ ...m, section: inferMaterialCategory(m.desc, m.section) })),
    [],
  )

  const workflowPhase = detectWorkflowPhaseFromText(text)
  const agreedPrices = extractAgreedPricesFromText(text)
  const result = {
    boqRows,
    materials: categorized.materials,
    matCategories: categorized.categories,
    labor,
    risks,
    collections,
    assumptions,
    exclusions,
    provisional,
    takeoffNotes,
    contractSum,
    projectTitle,
    projectScope,
    hasEstimate,
    hasBOQ,
    hasRisks,
    confidence,
    workflowPhase,
    agreedPrices,
    hasAgreedPrices: agreedPrices.length > 0,
    requiresApproval: shouldHoldAutoMerge({ boqRows, assumptions, workflowPhase }),
    userApprovedPricing: /user\s+confirmed|approved\s+pricing|proceed\s+with\s+pricing/i.test(text),
  }
  return result
}

function emptyResult() {
  return {
    boqRows: [], materials: [], matCategories: [], labor: [], risks: [], collections: [],
    assumptions: [], exclusions: [], provisional: [], takeoffNotes: '',
    contractSum: null, projectTitle: null, projectScope: null,
    hasEstimate: false, hasBOQ: false, hasRisks: false, confidence: 'low',
    workflowPhase: null, requiresApproval: false, userApprovedPricing: false,
    agreedPrices: [], hasAgreedPrices: false,
  }
}
