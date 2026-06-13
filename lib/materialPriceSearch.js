import { createSupabaseServerClient, isSupabaseServerConfigured, formatSupabaseError } from './supabaseServer.js'
import { materialPriceToRow, rowToMaterialPrice } from './materialPriceMapper.js'

/** Materials the app actively searches for. */
export const SEARCHABLE_MATERIALS = [
  { key: 'cement-42.5r', name: 'Portland cement 42.5R', category: 'Cement', specification: '50kg bag', unit: 'bag', queries: ['portland cement 42.5R 50kg ghana', 'dangote cement 42.5 ghana'] },
  { key: 'cement-32.5r', name: 'Portland cement 32.5R', category: 'Cement', specification: '50kg bag', unit: 'bag', queries: ['portland cement 32.5R 50kg ghana', 'ghacem cement 32.5 ghana'] },
  { key: 'blocks-solid', name: 'Solid sandcrete block', category: 'Blocks', specification: '6 inch', unit: 'nr', queries: ['sandcrete block 6 inch ghana price', 'solid block ghana building'] },
  { key: 'blocks-hollow', name: 'Hollow sandcrete block', category: 'Blocks', specification: '9 inch', unit: 'nr', queries: ['hollow sandcrete block 9 inch ghana'] },
  { key: 'sand', name: 'Sharp sand', category: 'Sand', specification: 'Per m³ or trip', unit: 'm³', queries: ['sharp sand ghana price m3', 'building sand accra'] },
  { key: 'chippings', name: '3/4 chippings', category: 'Chippings', specification: 'Per m³', unit: 'm³', queries: ['3/4 chippings ghana price', 'granite chippings accra'] },
  { key: 'rebar-y12', name: 'Y12 reinforcement bar', category: 'Reinforcement steel', specification: '12mm', unit: 'kg', queries: ['y12 reinforcement steel ghana price', 'iron rod 12mm ghana'] },
  { key: 'rebar-y16', name: 'Y16 reinforcement bar', category: 'Reinforcement steel', specification: '16mm', unit: 'kg', queries: ['y16 reinforcement steel ghana price', 'iron rod 16mm ghana'] },
  { key: 'tiles-floor', name: 'Floor tiles', category: 'Tiles', specification: 'Per m² or box', unit: 'm²', queries: ['floor tiles ghana price m2', 'ceramic floor tiles accra'] },
  { key: 'tiles-wall', name: 'Wall tiles', category: 'Tiles', specification: 'Per m² or box', unit: 'm²', queries: ['wall tiles ghana price'] },
  { key: 'paint-emulsion', name: 'Emulsion paint', category: 'Paint', specification: '20L bucket', unit: 'bucket', queries: ['emulsion paint 20L ghana price', 'dulux paint ghana'] },
  { key: 'plywood', name: 'Marine plywood', category: 'Timber/plywood', specification: '18mm sheet', unit: 'sheet', queries: ['marine plywood 18mm ghana price', 'plywood sheet ghana'] },
  { key: 'plumbing', name: 'PVC pipes & fittings', category: 'Plumbing materials', specification: 'Assorted', unit: 'ls', queries: ['pvc pipe fittings ghana building'] },
  { key: 'electrical', name: 'Electrical conduit & cable', category: 'Electrical materials', specification: 'Assorted', unit: 'ls', queries: ['electrical cable conduit ghana price'] },
  { key: 'waterproofing', name: 'Bitumen waterproofing membrane', category: 'Waterproofing products', specification: 'Roll', unit: 'm²', queries: ['bitumen waterproofing membrane ghana'] },
  { key: 'tile-adhesive', name: 'Tile adhesive', category: 'Adhesives/grout', specification: '20kg bag', unit: 'bag', queries: ['tile adhesive 20kg ghana price'] },
  { key: 'grout', name: 'Tile grout', category: 'Adhesives/grout', specification: '5kg bag', unit: 'bag', queries: ['tile grout ghana price'] },
  { key: 'roofing', name: 'Aluminium roofing sheet', category: 'Roofing materials', specification: 'Gauge/profile', unit: 'm²', queries: ['aluminium roofing sheet ghana price'] },
]

const USER_AGENT = 'Mozilla/5.0 (compatible; ConstructIQ/1.0; +https://github.com/lutnex/LUTTY-COINSTRUCTION-APP)'

function parseGhsPrice(text = '') {
  const cleaned = String(text).replace(/,/g, '')
  const m = cleaned.match(/(?:GHS|GH\s*¢|¢|₵)\s*(\d+(?:\.\d{1,2})?)/i)
    || cleaned.match(/(\d+(?:\.\d{1,2})?)\s*(?:GHS|cedis)/i)
  if (!m) return null
  const value = parseFloat(m[1])
  if (!Number.isFinite(value) || value <= 0 || value > 500000) return null
  return value
}

function stripHtml(s = '') {
  return String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseJumiaHtml(html, pageUrl) {
  const results = []
  const chunks = html.split(/class="prd"/i).slice(1, 8)
  for (const chunk of chunks) {
    const name = stripHtml((chunk.match(/class="name"[^>]*>([\s\S]*?)<\/a>/i) || [])[1] || '')
    const priceText = stripHtml((chunk.match(/class="prc"[^>]*>([\s\S]*?)<\/div>/i) || [])[1] || '')
    const href = (chunk.match(/href="([^"]+)"/i) || [])[1] || ''
    const price = parseGhsPrice(priceText)
    if (!name || !price) continue
    results.push({
      materialName: name.slice(0, 120),
      price,
      unit: '',
      supplier: 'Jumia Ghana',
      supplierUrl: href.startsWith('http') ? href : `https://www.jumia.com.gh${href}`,
      location: 'Ghana',
      source: 'jumia',
      status: 'live',
    })
  }
  if (!results.length) {
    const priceMatches = [...html.matchAll(/GHS\s*([\d,]+(?:\.\d{1,2})?)/gi)].slice(0, 5)
    for (const match of priceMatches) {
      const price = parseGhsPrice(match[0])
      if (price) {
        results.push({
          materialName: 'Jumia listing',
          price,
          unit: '',
          supplier: 'Jumia Ghana',
          supplierUrl: pageUrl,
          location: 'Ghana',
          source: 'jumia',
          status: 'live',
        })
        break
      }
    }
  }
  return results
}

async function searchJumiaGhana(query) {
  const url = `https://www.jumia.com.gh/catalog/?q=${encodeURIComponent(query)}`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: AbortSignal.timeout(18000),
    })
    if (!res.ok) return []
    const html = await res.text()
    return parseJumiaHtml(html, url)
  } catch {
    return []
  }
}

async function searchDuckDuckGo(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + ' ghana price GHS')}`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const html = await res.text()
    const links = [...html.matchAll(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].slice(0, 5)
    for (const [, href, title] of links) {
      const snippet = html.slice(html.indexOf(title), html.indexOf(title) + 500)
      const price = parseGhsPrice(snippet)
      if (price) {
        return [{
          materialName: stripHtml(title).slice(0, 120),
          price,
          unit: '',
          supplier: 'Web search result',
          supplierUrl: href,
          location: 'Ghana',
          source: 'web',
          status: 'live',
        }]
      }
    }
    return []
  } catch {
    return []
  }
}

export async function searchLivePriceForMaterial(materialDef) {
  for (const query of materialDef.queries) {
    const jumia = await searchJumiaGhana(query)
    if (jumia.length) {
      const best = jumia[0]
      return {
        materialKey: materialDef.key,
        materialName: materialDef.name,
        specification: materialDef.specification,
        unit: materialDef.unit,
        price: best.price,
        supplier: best.supplier,
        supplierUrl: best.supplierUrl,
        location: best.location,
        source: best.source,
        status: 'live',
        checkedAt: new Date().toISOString(),
      }
    }
  }
  for (const query of materialDef.queries.slice(0, 1)) {
    const web = await searchDuckDuckGo(query)
    if (web.length) {
      const best = web[0]
      return {
        materialKey: materialDef.key,
        materialName: materialDef.name,
        specification: materialDef.specification,
        unit: materialDef.unit,
        price: best.price,
        supplier: best.supplier,
        supplierUrl: best.supplierUrl,
        location: best.location,
        source: best.source,
        status: 'live',
        checkedAt: new Date().toISOString(),
      }
    }
  }
  return {
    materialKey: materialDef.key,
    materialName: materialDef.name,
    specification: materialDef.specification,
    unit: materialDef.unit,
    price: null,
    supplier: '',
    supplierUrl: '',
    location: 'Ghana',
    source: 'none',
    status: 'manual_entry_required',
    checkedAt: new Date().toISOString(),
  }
}

export async function fetchCachedMaterialPrices(env = process.env) {
  if (!isSupabaseServerConfigured(env)) return { prices: [], error: null }
  const supabase = createSupabaseServerClient(env)
  if (!supabase) return { prices: [], error: 'Supabase not initialized' }

  const { data, error } = await supabase
    .from('material_prices')
    .select('*')
    .order('checked_at', { ascending: false })

  if (error) return { prices: [], error: formatSupabaseError(error) }
  return { prices: (data || []).map(rowToMaterialPrice).filter(Boolean), error: null }
}

export async function upsertMaterialPrices(items = [], env = process.env) {
  if (!isSupabaseServerConfigured(env)) {
    return { ok: false, saved: 0, error: 'Supabase is not configured' }
  }
  const supabase = createSupabaseServerClient(env)
  if (!supabase) return { ok: false, saved: 0, error: 'Supabase not initialized' }

  const rows = items.map(materialPriceToRow)
  const { error } = await supabase.from('material_prices').upsert(rows, { onConflict: 'material_key' })
  if (error) return { ok: false, saved: 0, error: formatSupabaseError(error) }
  return { ok: true, saved: rows.length, error: null }
}

export async function searchAllMaterialPrices({ refresh = false } = {}, env = process.env) {
  const cached = refresh ? { prices: [] } : await fetchCachedMaterialPrices(env)
  const cachedByKey = new Map((cached.prices || []).map(p => [p.materialKey, p]))
  const results = []
  const errors = []

  for (const material of SEARCHABLE_MATERIALS) {
    if (!refresh) {
      const existing = cachedByKey.get(material.key)
      if (existing?.price && existing.checkedAt) {
        const ageHrs = (Date.now() - new Date(existing.checkedAt).getTime()) / 3600000
        if (ageHrs < 24) {
          results.push(existing)
          continue
        }
      }
    }
    try {
      const found = await searchLivePriceForMaterial(material)
      results.push(found)
    } catch (err) {
      errors.push(`${material.name}: ${err instanceof Error ? err.message : 'search failed'}`)
      results.push({
        materialKey: material.key,
        materialName: material.name,
        specification: material.specification,
        unit: material.unit,
        price: null,
        status: 'manual_entry_required',
        checkedAt: new Date().toISOString(),
      })
    }
  }

  const upsert = await upsertMaterialPrices(results, env)
  if (!upsert.ok && upsert.error) errors.push(upsert.error)

  return {
    ok: errors.length === 0 || results.some(r => r.status === 'live'),
    prices: results,
    searched: SEARCHABLE_MATERIALS.length,
    live: results.filter(r => r.status === 'live').length,
    manual: results.filter(r => r.status === 'manual_entry_required').length,
    errors,
    supabaseSaved: upsert.saved || 0,
  }
}
