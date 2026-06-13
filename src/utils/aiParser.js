// src/utils/aiParser.js — Parse structured data from AI markdown responses

export function parseAIResponse(text) {
  const boqRows = [], materials = [], labor = [], risks = []
  let contractSum = null, projectTitle = null, projectScope = null

  if (!text) return makeEmpty()

  // ── Extract BOQ table rows ────────────────────────────────────────────────
  const tableRx = /\|([^\n]+)\|\n\|[-| :]+\|\n((?:\|[^\n]+\|\n?)*)/g
  let tm
  let rowId = Date.now()

  while ((tm = tableRx.exec(text)) !== null) {
    const headers = tm[1].split('|').map(h => h.trim().toLowerCase()).filter(Boolean)
    const rows = tm[2].trim().split('\n').filter(Boolean)
    const idx = (...keys) => { for (const k of keys) { const i = headers.findIndex(h => h.includes(k)); if (i >= 0) return i } return -1 }
    const si = idx('section', 'trade')
    const di = idx('desc', 'item', 'work', 'material', 'name')
    const ui = idx('unit')
    const qi = idx('qty', 'quan')
    const ri = idx('rate', 'price')
    const ai = idx('amount', 'total', 'ghs', 'cost')
    if (di < 0) continue

    for (const row of rows) {
      const cols = row.split('|').map(c => c.trim()).filter(Boolean)
      if (cols.length < 2) continue
      const get = i => (i >= 0 && i < cols.length) ? cols[i] : ''
      const desc = get(di)
      if (!desc || desc.length < 3 || /^[-=]+$/.test(desc)) continue
      const rawAmt = get(ai).replace(/[^\d.]/g, '')
      const q = get(qi).replace(/[^\d.]/g, '')
      const r = get(ri).replace(/[^\d.]/g, '')
      const amt = rawAmt || (q && r ? String(Math.round(parseFloat(q) * parseFloat(r) * 100) / 100) : '')
      boqRows.push({
        id: rowId++,
        section: get(si) || 'General',
        desc,
        unit: get(ui) || 'nr',
        qty: q, rate: r, amount: amt,
        clientSupplied: /client/i.test(get(ai)),
      })
    }
  }

  // ── Contract sum ─────────────────────────────────────────────────────────
  const sumRx = /(?:contract\s+sum|total\s+value|grand\s+total)[^\n]*?GHS\s*([\d,]+(?:\.\d+)?)/gi
  let sm
  while ((sm = sumRx.exec(text)) !== null) {
    const v = parseFloat(sm[1].replace(/,/g, ''))
    if (!isNaN(v) && v > 0) { contractSum = v; break }
  }
  if (!contractSum) {
    const alt = /GHS\s*([\d,]+(?:\.\d+)?)\s*(?:\n|$)/gi
    const nums = []
    let am
    while ((am = alt.exec(text)) !== null) {
      const v = parseFloat(am[1].replace(/,/g, ''))
      if (!isNaN(v) && v > 50000) nums.push(v)
    }
    if (nums.length) contractSum = Math.max(...nums)
  }

  // ── Project title ────────────────────────────────────────────────────────
  const tm2 = /###?\s*PROJECT\s+SUMMARY\s*\n+([^\n]+)/i.exec(text)
  if (tm2) projectTitle = tm2[1].trim()

  // ── Project scope ────────────────────────────────────────────────────────
  const sm2 = /###?\s*SCOPE\s+OF\s+WORKS?\s*\n+([\s\S]{20,300}?)(?=\n###|\n\*\*|$)/i.exec(text)
  if (sm2) projectScope = sm2[1].replace(/[#*]/g, '').trim().slice(0, 300)

  // ── Risks ────────────────────────────────────────────────────────────────
  const riskRx = /(?:high|medium|low)\s+risk[^:\n]*[:\s]+([^\n]{20,})/gi
  let rm, rid = Date.now() + 9000
  while ((rm = riskRx.exec(text)) !== null) {
    const rating = /high/i.test(rm[0]) ? 'HIGH' : /medium/i.test(rm[0]) ? 'MEDIUM' : 'LOW'
    risks.push({ id: rid++, risk: rm[1].trim().slice(0, 80), likelihood: 'Medium', impact: 'Medium', rating, mitigation: 'See AI analysis above' })
    if (risks.length >= 6) break
  }

  // ── Derive materials from BOQ ─────────────────────────────────────────────
  boqRows.filter(r => r.amount).slice(0, 15).forEach((r, i) => {
    materials.push({ id: i + 1, desc: r.desc, unit: r.unit, qty: r.qty, rate: r.rate, amount: r.amount, clientSupply: r.clientSupplied })
  })

  const hasEstimate = !!contractSum || /contract\s+sum|estimate\s+total/i.test(text)
  const hasBOQ = boqRows.length > 2
  const hasRisks = risks.length > 0 || /RISKS\s+AND\s+EXCLUSIONS/i.test(text)
  const confidence = boqRows.length > 5 && contractSum ? 'high' : boqRows.length > 2 || contractSum ? 'medium' : 'low'

  return { boqRows, materials, labor, risks, contractSum, projectTitle, projectScope, hasEstimate, hasBOQ, hasRisks, confidence }
}

function makeEmpty() {
  return { boqRows: [], materials: [], labor: [], risks: [], contractSum: null, projectTitle: null, projectScope: null, hasEstimate: false, hasBOQ: false, hasRisks: false, confidence: 'low' }
}
