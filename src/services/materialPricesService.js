/**
 * Client service for material price lookup (server-side search only).
 */

export async function fetchMaterialPrices() {
  try {
    const res = await fetch('/api/materials/list', { cache: 'no-store' })
    const data = await res.json().catch(() => null)
    if (res.ok && data?.prices) return { prices: data.prices, error: null }
    return { prices: [], error: data?.error || `List failed (${res.status})` }
  } catch (err) {
    return { prices: [], error: err instanceof Error ? err.message : 'Fetch failed' }
  }
}

export async function searchLiveMaterialPrices({ refresh = true } = {}) {
  try {
    const res = await fetch('/api/materials/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })
    const data = await res.json().catch(() => null)
    if (!data) return { ok: false, prices: [], errors: ['Invalid response'] }
    return {
      ok: Boolean(data.ok),
      prices: data.prices || [],
      searched: data.searched || 0,
      live: data.live || 0,
      manual: data.manual || 0,
      errors: data.errors || [],
      warning: data.warning || null,
    }
  } catch (err) {
    return { ok: false, prices: [], errors: [err instanceof Error ? err.message : 'Search failed'] }
  }
}

export function livePriceToProfile(price) {
  if (!price?.price) return null
  return {
    id: Date.now() + Math.random(),
    material: price.materialName,
    specification: price.specification || '',
    unit: price.unit || '',
    price: String(price.price),
    supplier: price.supplier || '',
    location: price.location || 'Ghana',
    supplierUrl: price.supplierUrl || '',
    lastUpdated: price.checkedAt ? price.checkedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    source: price.source || 'live',
  }
}
