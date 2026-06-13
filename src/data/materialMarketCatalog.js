/**
 * Material market catalog — manual entry required unless user adds live supplier data.
 * Never invent prices; status drives UI messaging.
 */

export const MARKET_CATEGORIES = [
  'Cement',
  'Blocks',
  'Sand',
  'Chippings',
  'Reinforcement steel',
  'Tiles',
  'Paint',
  'Plumbing materials',
  'Electrical materials',
  'Roofing materials',
  'Timber/plywood',
  'Waterproofing products',
  'Adhesives/grout',
]

function manualEntry(category, name, specification = '', unit = '') {
  return {
    id: `${category}-${name}`.replace(/\s+/g, '-').toLowerCase(),
    category,
    name,
    specification,
    price: null,
    unit: unit || '—',
    supplier: null,
    location: null,
    url: null,
    lastChecked: null,
    trend: null,
    status: 'manual_entry_required',
  }
}

export const MATERIAL_MARKET_CATALOG = [
  manualEntry('Cement', 'Portland cement 42.5R', '50kg bag', 'bag'),
  manualEntry('Cement', 'Portland cement 32.5R', '50kg bag', 'bag'),
  manualEntry('Blocks', 'Solid sandcrete block', '6" (150mm)', 'nr'),
  manualEntry('Blocks', 'Hollow sandcrete block', '9" (225mm)', 'nr'),
  manualEntry('Sand', 'Sharp sand', 'Per m³ or trip', 'm³'),
  manualEntry('Chippings', '3/4 chippings', 'Per m³ or truckload', 'm³'),
  manualEntry('Reinforcement steel', 'Y12 reinforcement bar', 'Per tonne or length', 'kg'),
  manualEntry('Reinforcement steel', 'Y16 reinforcement bar', 'Per tonne or length', 'kg'),
  manualEntry('Tiles', 'Floor tiles', 'Size/type — price per m² or per box', 'm²'),
  manualEntry('Tiles', 'Wall tiles', 'Size/type — price per m² or per box', 'm²'),
  manualEntry('Paint', 'Emulsion paint', '20L bucket — coverage & brand', 'bucket'),
  manualEntry('Plumbing materials', 'PVC pipes & fittings', 'First fix / second fix / client-supplied', 'ls'),
  manualEntry('Electrical materials', 'Conduit, cable, accessories', 'First fix / second fix / client-supplied', 'ls'),
  manualEntry('Roofing materials', 'Aluminium roofing sheet', 'Gauge/profile', 'm²'),
  manualEntry('Timber/plywood', 'Marine plywood', '18mm', 'sheet'),
  manualEntry('Waterproofing products', 'Bitumen membrane', 'Roll size', 'm²'),
  manualEntry('Adhesives/grout', 'Tile adhesive', '20kg bag', 'bag'),
]

export function getMarketCatalogByCategory() {
  const map = new Map()
  for (const item of MATERIAL_MARKET_CATALOG) {
    if (!map.has(item.category)) map.set(item.category, [])
    map.get(item.category).push(item)
  }
  return [...map.entries()].map(([category, items]) => ({ category, items }))
}

export function findMarketPrice(catalog, { material, specification } = {}) {
  const needle = `${material || ''} ${specification || ''}`.toLowerCase().trim()
  if (!needle) return null
  return catalog.find(item => {
    const hay = `${item.name} ${item.specification}`.toLowerCase()
    return hay.includes(needle) || needle.includes(item.name.toLowerCase())
  }) || null
}
