/**
 * Parse commercial summary category totals from AI chat output.
 */

const CATEGORY_RULES = [
  { key: 'materials', test: /materials?\s*(?:\/\s*works)?/i },
  { key: 'labour', test: /labou?r/i },
  { key: 'earthworks', test: /earth\s*works/i },
  { key: 'filling', test: /filling/i },
  { key: 'transport', test: /transport/i },
  { key: 'preliminaries', test: /preliminar/i },
]

function parseAmount(value = '') {
  const v = parseFloat(String(value).replace(/[^\d.]/g, ''))
  return Number.isFinite(v) ? v : 0
}

export function assignCommercialCategory(breakdown, desc = '', amount) {
  const amt = typeof amount === 'number' ? amount : parseAmount(amount)
  if (amt <= 0) return breakdown
  const text = String(desc || '').trim()
  for (const { key, test } of CATEGORY_RULES) {
    if (!test.test(text)) continue
    // Commercial tables may include sub-lines — keep the largest materials total.
    if (key === 'materials' && breakdown[key] > 0) {
      breakdown[key] = Math.max(breakdown[key], amt)
    } else if (breakdown[key] == null) {
      breakdown[key] = amt
    }
    return breakdown
  }
  return breakdown
}

/** Parse GHS amounts from commercial summary tables and inline text. */
export function parseCommercialBreakdown(text = '', commercialRows = []) {
  const breakdown = {}

  for (const row of commercialRows) {
    assignCommercialCategory(breakdown, row.desc || row.section, row.amount)
  }

  if (!text) return breakdown

  for (const { key, test } of CATEGORY_RULES) {
    if (breakdown[key] != null) continue
    const rx = new RegExp(`${test.source}[^\\n|]*?(?:GHS\\s*)?([\\d,]+(?:\\.\\d+)?)`, 'i')
    const m = rx.exec(text)
    if (m) breakdown[key] = parseAmount(m[1])
  }

  const contractRx = /(?:contract\s+sum|total\s+contract\s+sum|grand\s+total)[^\n]*?GHS\s*([\d,]+(?:\.\d+)?)/i
  const cm = contractRx.exec(text)
  if (cm) breakdown.contractSum = parseAmount(cm[1])

  return breakdown
}

export function commercialDirectCostTotal(breakdown = {}) {
  return (breakdown.materials || 0)
    + (breakdown.labour || 0)
    + (breakdown.earthworks || 0)
    + (breakdown.filling || 0)
    + (breakdown.transport || 0)
    + (breakdown.preliminaries || 0)
}

export function hasCommercialBreakdown(breakdown = {}) {
  return CATEGORY_RULES.some(({ key }) => breakdown[key] > 0)
}
