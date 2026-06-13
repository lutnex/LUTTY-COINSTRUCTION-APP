import { DEFAULT_PRICES } from './constants.js'

export const PRICE_STORAGE_KEY = 'constructiq-price-profiles'

export function loadPriceProfiles() {
  try {
    const raw = localStorage.getItem(PRICE_STORAGE_KEY)
    if (!raw) return [...DEFAULT_PRICES]
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.length) return [...DEFAULT_PRICES]
    return parsed.map((p, i) => ({
      id: p.id ?? Date.now() + i,
      material: String(p.material || '').trim(),
      unit: String(p.unit || 'nr').trim(),
      price: String(p.price ?? ''),
      supplier: String(p.supplier || '').trim(),
      specification: String(p.specification || '').trim(),
      location: String(p.location || '').trim(),
      lastUpdated: p.lastUpdated || null,
      source: p.source || 'user',
    })).filter(p => p.material)
  } catch {
    return [...DEFAULT_PRICES]
  }
}

export function savePriceProfiles(prices = []) {
  try {
    localStorage.setItem(PRICE_STORAGE_KEY, JSON.stringify(prices))
    return true
  } catch (e) {
    console.error('[priceStore] save failed', e)
    return false
  }
}

export function findSavedPrice(prices, { material, specification, unit } = {}) {
  const needle = `${material || ''} ${specification || ''}`.toLowerCase().trim()
  if (!needle) return null
  return prices.find(p => {
    const hay = `${p.material} ${p.specification || ''}`.toLowerCase()
    const unitMatch = !unit || !p.unit || p.unit === unit
    return unitMatch && (hay.includes(needle) || needle.includes(p.material.toLowerCase()))
  }) || null
}
