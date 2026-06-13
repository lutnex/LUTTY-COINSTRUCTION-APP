import { PRICE_CATEGORIES, PRICE_ITEM_SOURCES } from './priceProfileTypes.js'

const CURRENCY = 'GHS'
const today = () => new Date().toISOString().slice(0, 10)

const LABOUR_RX = /\b(labou?r|tiler|mason|carpenter|plumber|electrician|painter|foreman|supervisor|operator)\b/i
const EQUIPMENT_RX = /\b(excavator|mixer|crane|compactor|generator|pump|scaffold|equipment|plant hire)\b/i
const TRANSPORT_RX = /\b(transport|haulage|delivery|trip|truck|lorry)\b/i
const SUBCONTRACT_RX = /\b(subcontract|specialist|sub-contract)\b/i
const PROVISIONAL_RX = /\b(provisional|pc sum|prime cost)\b/i
const CLIENT_RX = /\b(client[\s-]?supplied|by client)\b/i

function inferCategory(name = '', context = '') {
  const t = `${name} ${context}`.toLowerCase()
  if (CLIENT_RX.test(t)) return PRICE_CATEGORIES.CLIENT_SUPPLIED
  if (PROVISIONAL_RX.test(t)) return PRICE_CATEGORIES.PROVISIONAL
  if (SUBCONTRACT_RX.test(t)) return PRICE_CATEGORIES.SUBCONTRACT
  if (TRANSPORT_RX.test(t)) return PRICE_CATEGORIES.TRANSPORT
  if (EQUIPMENT_RX.test(t)) return PRICE_CATEGORIES.EQUIPMENT
  if (LABOUR_RX.test(t)) return PRICE_CATEGORIES.LABOUR
  return PRICE_CATEGORIES.MATERIAL
}

function parsePriceValue(raw) {
  const n = parseFloat(String(raw || '').replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 && n < 500000 ? n : null
}

function splitNameAndSpec(rawName = '') {
  const name = rawName.trim()
  const inch = name.match(/(\d[\d./]*\s*-?\s*inch)/i)
  const grade = name.match(/(42\.5R|32\.5R|Y\d+|Grade\s*\w+)/i)
  const spec = [inch?.[1], grade?.[1]].filter(Boolean).join(', ')
  return { name: name.replace(/\s+/g, ' '), specification: spec }
}

function makeItem({
  name,
  specification = '',
  unit = '',
  price,
  category,
  supplier = '',
  location = '',
  notes = '',
  source = PRICE_ITEM_SOURCES.USER_AGREED,
  chatRef = '',
}) {
  const { name: n, specification: autoSpec } = splitNameAndSpec(name)
  return {
    id: `extract-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    material: n,
    specification: specification || autoSpec,
    unit: unit || 'nr',
    price: String(price),
    currency: CURRENCY,
    category: category || inferCategory(n, notes),
    supplier,
    supplierUrl: '',
    location,
    source,
    notes,
    lastUpdated: today(),
    chatRef,
  }
}

function addItem(items, seen, item) {
  const key = `${item.material}|${item.specification}|${item.unit}|${item.category}`.toLowerCase()
  if (seen.has(key)) return
  seen.add(key)
  items.push(item)
}

/** Extract agreed prices from chat message text. */
export function extractAgreedPricesFromText(text = '', { role = 'user', chatRef = '' } = {}) {
  const items = []
  const seen = new Set()
  if (!text?.trim()) return items

  const source = role === 'user' ? PRICE_ITEM_SOURCES.USER_AGREED : PRICE_ITEM_SOURCES.USER_AGREED

  // Section: ### AGREED PRICES / MATERIAL PRICES / CONFIRMED RATES
  const sectionRx = /###?\s*(?:AGREED|CONFIRMED|MATERIAL|LABOUR|UNIT)\s*(?:PRICES?|RATES?)[^\n]*\n+([\s\S]*?)(?=\n###|\n\*\*|$)/gi
  let sm
  while ((sm = sectionRx.exec(text)) !== null) {
    extractLinesFromBlock(sm[1], items, seen, source, chatRef)
  }

  // Inline patterns: Name = 110 GHS/bag | Name @ GHS 110 per bag | Name: 110/bag
  const inlinePatterns = [
    /(?:^|[-*•\d.)\s]+)([^=\n:@]{3,60}?)\s*[=:@]\s*(?:GHS\s*)?(\d+(?:\.\d{1,2})?)\s*(?:GHS)?(?:\s*(?:\/|per)\s*([\w³²()./-]+))?/gim,
    /(?:^|[-*•\d.)\s]+)([^=\n]{3,50}?)\s+(?:at|@)\s*(?:GHS\s*)?(\d+(?:\.\d{1,2})?)\s*(?:GHS)?(?:\s*(?:\/|per)\s*([\w³²()./-]+))?/gim,
    /(\w[\w\s/.-]{2,50}?)\s*[-–]\s*(?:GHS\s*)?(\d+(?:\.\d{1,2})?)\s*(?:GHS)?(?:\s*(?:\/|per)\s*([\w³²()./-]+))?/gim,
  ]

  for (const rx of inlinePatterns) {
    let m
    while ((m = rx.exec(text)) !== null) {
      const rawName = m[1].replace(/^[-*•\d.)\s]+/, '').trim()
      if (!rawName || rawName.length < 3) continue
      if (/^(total|subtotal|amount|section|bill|item|qty|rate)$/i.test(rawName)) continue
      const price = parsePriceValue(m[2])
      if (!price) continue
      const unit = (m[3] || '').trim() || inferUnit(rawName)
      addItem(items, seen, makeItem({
        name: rawName,
        unit,
        price,
        category: inferCategory(rawName),
        source,
        chatRef,
        notes: role === 'user' ? 'Agreed in chat (user)' : 'Agreed in chat',
      }))
    }
  }

  // Table rows: | Material | Unit | Price |
  const tableRx = /\|([^\n]+)\|\n\|[-| :]+\|\n((?:\|[^\n]+\|\n?)*)/g
  let tm
  while ((tm = tableRx.exec(text)) !== null) {
    const header = tm[1].toLowerCase()
    if (!/(material|item|labour|labor|rate|price)/i.test(header)) continue
    const lines = tm[2].trim().split('\n')
    for (const line of lines) {
      const cols = line.split('|').map(c => c.trim()).filter(Boolean)
      if (cols.length < 2) continue
      const name = cols[0]
      const priceCol = cols.find(c => /GHS\s*\d|^\d+\.?\d*$/.test(c)) || cols[cols.length - 1]
      const price = parsePriceValue(priceCol.replace(/[^\d.]/g, ''))
      if (!name || !price || name.length < 3) continue
      const unitCol = cols.find(c => /^(bag|m²|m2|m³|nr|day|kg|sheet|bucket|block|ls)$/i.test(c)) || cols[1] || ''
      addItem(items, seen, makeItem({
        name,
        unit: unitCol || inferUnit(name),
        price,
        category: inferCategory(name),
        source,
        chatRef,
      }))
    }
  }

  return items
}

function extractLinesFromBlock(block, items, seen, source, chatRef) {
  for (const line of block.split('\n')) {
    const t = line.replace(/^[-*•\d.]+\s*/, '').trim()
    if (t.length < 5) continue
    const m = t.match(/^(.+?)\s*[=:@-]\s*(?:GHS\s*)?(\d+(?:\.\d{1,2})?)\s*(?:GHS)?(?:\s*(?:\/|per)\s*([\w³²()./-]+))?/i)
    if (!m) continue
    const price = parsePriceValue(m[2])
    if (!price) continue
    addItem(items, seen, makeItem({
      name: m[1].trim(),
      unit: (m[3] || '').trim() || inferUnit(m[1]),
      price,
      source,
      chatRef,
    }))
  }
}

function inferUnit(name = '') {
  const n = name.toLowerCase()
  if (/cement|adhesive|grout|paint/.test(n)) return /paint/.test(n) ? 'bucket' : 'bag'
  if (/block/.test(n)) return 'nr'
  if (/tile/.test(n)) return 'm²'
  if (/labou?r|mason|tiler|day/.test(n)) return 'day'
  if (/sand|chipping|m³/.test(n)) return 'm³'
  if (/rebar|steel|kg/.test(n)) return 'kg'
  if (/plywood|sheet/.test(n)) return 'sheet'
  return 'nr'
}

/** Extract from full chat history (user + assistant messages). */
export function extractAgreedPricesFromChat(msgs = []) {
  const all = []
  const seen = new Set()
  for (const msg of msgs) {
    const text = [msg.content, msg.display].filter(Boolean).join('\n')
    const extracted = extractAgreedPricesFromText(text, { role: msg.role, chatRef: String(msg.id || '') })
    for (const item of extracted) {
      const key = `${item.material}|${item.specification}|${item.unit}|${item.category}`.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      all.push(item)
    }
    // Also pull from structured extract if AI returned material/labor tables
    if (msg.extract) {
      for (const row of [...(msg.extract.materials || []), ...(msg.extract.labor || [])]) {
        const rate = parsePriceValue(row.rate)
        if (!rate) continue
        addItem(all, seen, makeItem({
          name: row.desc || row.material || '',
          specification: row.specification || '',
          unit: row.unit || 'nr',
          price: rate,
          category: inferCategory(row.desc || ''),
          supplier: row.supplier || '',
          source: PRICE_ITEM_SOURCES.AI_SUGGESTED,
          chatRef: String(msg.id || ''),
        }))
      }
    }
  }
  return all
}

export function hasExtractablePrices(msgs = []) {
  return extractAgreedPricesFromChat(msgs).length > 0
}
