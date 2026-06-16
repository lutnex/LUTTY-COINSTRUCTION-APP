/**
 * Manual financial adjustments — QS-grade commercial control.
 * Nothing is calculated until the user enables an item.
 */

export const FINANCIAL_ITEM_ORDER = ['contingency', 'overheads', 'profit', 'vat', 'discount']

export const FINANCIAL_ITEM_META = {
  contingency: { label: 'Contingency', isDeduction: false },
  overheads: { label: 'Contractor Overheads', isDeduction: false },
  profit: { label: 'Contractor Profit', isDeduction: false },
  vat: { label: 'VAT', isDeduction: false },
  discount: { label: 'Discount', isDeduction: true },
}

export const DEFAULT_ADJUSTMENT_ITEM = {
  enabled: false,
  mode: 'percentage',
  value: '',
  locked: false,
  frozenAmount: null,
}

export function createDefaultFinancialAdjustments() {
  return {
    contingency: { ...DEFAULT_ADJUSTMENT_ITEM },
    overheads: { ...DEFAULT_ADJUSTMENT_ITEM },
    profit: { ...DEFAULT_ADJUSTMENT_ITEM },
    vat: { ...DEFAULT_ADJUSTMENT_ITEM },
    discount: { ...DEFAULT_ADJUSTMENT_ITEM, mode: 'fixed' },
  }
}

export const DEFAULT_ESTIMATE_PREFERENCES = {
  autoContingency: false,
  autoOverheads: false,
  autoProfit: false,
  autoVat: false,
}

const STORAGE_KEY_ADJ = 'constructiq-financial-adjustments'
const STORAGE_KEY_PREF = 'constructiq-estimate-preferences'

export function loadFinancialAdjustments() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ADJ)
    if (!raw) return createDefaultFinancialAdjustments()
    return { ...createDefaultFinancialAdjustments(), ...JSON.parse(raw) }
  } catch {
    return createDefaultFinancialAdjustments()
  }
}

export function persistFinancialAdjustments(adjustments) {
  try {
    localStorage.setItem(STORAGE_KEY_ADJ, JSON.stringify(adjustments))
  } catch { /* ignore */ }
}

export function loadEstimatePreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREF)
    if (!raw) return { ...DEFAULT_ESTIMATE_PREFERENCES }
    return { ...DEFAULT_ESTIMATE_PREFERENCES, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_ESTIMATE_PREFERENCES }
  }
}

export function persistEstimatePreferences(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY_PREF, JSON.stringify(prefs))
  } catch { /* ignore */ }
}

function resolveItemAmount(item, runningTotal, projectSubtotal) {
  if (!item?.enabled) return 0

  const raw = parseFloat(String(item.value).replace(/,/g, '')) || 0

  if (item.locked) {
    if (item.mode === 'fixed') return raw
    if (item.frozenAmount != null && item.frozenAmount !== '') {
      return parseFloat(item.frozenAmount) || 0
    }
    return runningTotal * (raw / 100)
  }

  if (item.mode === 'fixed') return raw
  const base = runningTotal
  return base * (raw / 100)
}

/**
 * Apply enabled adjustments in order on a running total.
 * @returns {{ lines, finalTotal, enabledLines }}
 */
export function applyFinancialAdjustments(projectSubtotal, adjustments) {
  const adj = adjustments && typeof adjustments === 'object' ? adjustments : {}
  const sub = parseFloat(projectSubtotal) || 0
  let running = sub
  const lines = []
  const enabledLines = []

  for (const id of FINANCIAL_ITEM_ORDER) {
    const item = adj[id]
    const meta = FINANCIAL_ITEM_META[id]
    if (!item?.enabled) continue

    const amount = resolveItemAmount(item, running, sub)
    const signed = meta.isDeduction ? -Math.abs(amount) : Math.abs(amount)

    const line = {
      id,
      label: meta.label,
      amount: Math.abs(amount),
      signed,
      isDeduction: meta.isDeduction,
      mode: item.mode,
      value: item.value,
      locked: item.locked,
    }
    lines.push(line)
    enabledLines.push(line)
    running += signed
  }

  return {
    projectSubtotal: sub,
    lines,
    enabledLines,
    finalTotal: running,
  }
}

/** When locking a percentage-based item, freeze the current computed amount. */
export function freezeAdjustmentAmount(item, runningTotal, projectSubtotal) {
  if (!item?.enabled) return item
  if (item.mode === 'fixed') return { ...item, locked: true }
  const amt = resolveItemAmount({ ...item, locked: false }, runningTotal, projectSubtotal)
  return { ...item, locked: true, frozenAmount: String(amt.toFixed(2)) }
}

export function applyPreferenceDefaults(adjustments, preferences) {
  const next = { ...createDefaultFinancialAdjustments(), ...(adjustments && typeof adjustments === 'object' ? adjustments : {}) }
  const map = [
    ['contingency', preferences.autoContingency],
    ['overheads', preferences.autoOverheads],
    ['profit', preferences.autoProfit],
    ['vat', preferences.autoVat],
  ]
  for (const [key, auto] of map) {
    if (auto && !next[key]?.enabled) {
      next[key] = { ...next[key], enabled: true }
    }
  }
  return next
}
