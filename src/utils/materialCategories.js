/**
 * Material categories for Document Generator — QS-style grouped schedules.
 */

export const DEFAULT_CATEGORY_NAME = 'General'

/** Normalize category id for reliable comparison (select values are strings). */
export function sameCategoryId(a, b) {
  if (a == null || b == null) return false
  return String(a) === String(b)
}

export function findCategoryById(categories, id) {
  if (id == null) return null
  return categories.find(c => sameCategoryId(c.id, id)) ?? null
}

export const SUGGESTED_CATEGORIES = [
  'Masonry Works',
  'Concrete Works',
  'Reinforcement Works',
  'Carpentry Works',
  'Roofing Works',
  'Electrical Works',
  'Plumbing Works',
  'Tiling Works',
  'Painting Works',
  'Finishes',
  'Preliminaries',
]

const KEYWORD_RULES = [
  { category: 'Masonry Works', keywords: ['block', 'brick', 'mortar', 'cement', 'sand', 'masonry', 'render'] },
  { category: 'Concrete Works', keywords: ['concrete', 'blinding', 'screed', 'formwork', 'curing'] },
  { category: 'Reinforcement Works', keywords: ['rebar', 'reinforcement', 'steel bar', 'mesh', 'y12', 'y16', 'y10', 'binding wire'] },
  { category: 'Carpentry Works', keywords: ['timber', 'plywood', 'door', 'window', 'joinery', 'wood', 'nail', 'screw'] },
  { category: 'Roofing Works', keywords: ['roof', 'ridge', 'truss', 'aluzinc', 'gutter', 'fascia', 'soffit', 'flashing'] },
  { category: 'Electrical Works', keywords: ['cable', 'wire', 'socket', 'switch', 'conduit', 'electrical', 'mcb', 'db board', 'lighting'] },
  { category: 'Plumbing Works', keywords: ['pipe', 'pvc', 'plumb', 'sanitary', 'wc', 'basin', 'tap', 'geyser', 'manhole'] },
  { category: 'Tiling Works', keywords: ['tile', 'adhesive', 'grout', 'ceramic', 'porcelain'] },
  { category: 'Painting Works', keywords: ['paint', 'primer', 'emulsion', 'putty', 'sealer', 'varnish'] },
  { category: 'Finishes', keywords: ['plaster', 'skim', 'pop', 'gypsum', 'ceiling', 'cladding', 'laminate'] },
  { category: 'Preliminaries', keywords: ['prelim', 'mobilization', 'site office', 'hoarding', 'supervision'] },
]

export function createCategory(name = DEFAULT_CATEGORY_NAME) {
  return { id: Date.now() + Math.random(), name: String(name || DEFAULT_CATEGORY_NAME).trim() || DEFAULT_CATEGORY_NAME }
}

export function createMaterial(categoryId, overrides = {}) {
  return {
    id: Date.now() + Math.random(),
    categoryId,
    desc: '',
    unit: 'nr',
    qty: '',
    rate: '',
    amount: '',
    clientSupply: false,
    ...overrides,
  }
}

export function stripSectionPrefix(desc = '') {
  return String(desc).replace(/^\[[^\]]+\]\s*/, '').trim()
}

const BILL_TITLE_MAP = [
  { match: /masonry|blockwork/i, category: 'Masonry Works' },
  { match: /concrete|reinforced concrete/i, category: 'Concrete Works' },
  { match: /reinforcement|rebar|steel/i, category: 'Reinforcement Works' },
  { match: /carpentry|joinery|timber|door|window/i, category: 'Carpentry Works' },
  { match: /roof/i, category: 'Roofing Works' },
  { match: /electrical/i, category: 'Electrical Works' },
  { match: /plumb|sanitary/i, category: 'Plumbing Works' },
  { match: /tile|floor finish/i, category: 'Tiling Works' },
  { match: /paint|decorat/i, category: 'Painting Works' },
  { match: /finish|plaster|ceiling/i, category: 'Finishes' },
  { match: /prelim/i, category: 'Preliminaries' },
]

export function inferMaterialCategory(desc = '', section = '') {
  const sec = String(section || '').trim()
  const text = `${desc} ${sec}`.toLowerCase()

  for (const rule of BILL_TITLE_MAP) {
    if (rule.match.test(sec)) return rule.category
  }

  if (sec && sec !== DEFAULT_CATEGORY_NAME && !/^b\d+\s*[—–-]/i.test(sec)) return sec
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some(kw => text.includes(kw))) return rule.category
  }
  return sec || DEFAULT_CATEGORY_NAME
}

export function findOrCreateCategory(categories, name) {
  const trimmed = String(name || DEFAULT_CATEGORY_NAME).trim() || DEFAULT_CATEGORY_NAME
  const existing = categories.find(c => c.name.toLowerCase() === trimmed.toLowerCase())
  if (existing) return { categories, categoryId: existing.id }
  const cat = createCategory(trimmed)
  return { categories: [...categories, cat], categoryId: cat.id }
}

/** Migrate legacy flat materials (section in desc or section field). */
export function normalizeMaterialState(materials = [], categories = []) {
  let cats = [...(categories || [])]
  const mats = []

  for (const raw of materials || []) {
    const legacySection = raw.section || inferMaterialCategory(stripSectionPrefix(raw.desc), '')
    const { categories: nextCats, categoryId } = findOrCreateCategory(
      cats,
      raw.categoryId ? (findCategoryById(cats, raw.categoryId)?.name || legacySection) : legacySection,
    )
    cats = nextCats
    const matched = raw.categoryId ? findCategoryById(cats, raw.categoryId) : null
    const resolvedId = matched?.id ?? categoryId

    mats.push({
      ...createMaterial(resolvedId, raw),
      id: raw.id ?? Date.now() + Math.random(),
      desc: stripSectionPrefix(raw.desc),
      categoryId: resolvedId,
    })
  }

  if (!cats.length) cats = [createCategory(DEFAULT_CATEGORY_NAME)]
  return { categories: cats, materials: mats }
}

export function groupMaterialsByCategory(categories, materials) {
  const ordered = [...categories]
  const groups = ordered.map(cat => ({
    category: cat,
    items: materials.filter(m => sameCategoryId(m.categoryId, cat.id)),
  }))

  const known = new Set(ordered.map(c => String(c.id)))
  const orphan = materials.filter(m => !known.has(String(m.categoryId)))
  if (orphan.length) {
    const general = ordered.find(c => c.name === DEFAULT_CATEGORY_NAME) || ordered[0]
    const g = groups.find(gr => sameCategoryId(gr.category.id, general?.id))
    if (g) g.items.push(...orphan)
    else if (general) groups.push({ category: general, items: orphan })
  }

  return groups
}

export function categorySubtotal(items = []) {
  return items.reduce((sum, r) => {
    if (r.clientSupply) return sum
    return sum + (parseFloat(r.amount) || 0)
  }, 0)
}

export function materialsGrandTotal(materials = []) {
  return categorySubtotal(materials)
}

export function reorderList(list, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) {
    return list
  }
  const copy = [...list]
  const [item] = copy.splice(fromIndex, 1)
  copy.splice(toIndex, 0, item)
  return copy
}

export function assignMaterialsCategory(materials, categoryId, fromCategoryId) {
  return materials.map(m => (sameCategoryId(m.categoryId, fromCategoryId) ? { ...m, categoryId } : m))
}

export function removeCategoryFromState(categories, materials, categoryId) {
  const target = categories.find(c => c.name === DEFAULT_CATEGORY_NAME && !sameCategoryId(c.id, categoryId))
    || categories.find(c => !sameCategoryId(c.id, categoryId))
  const nextCategories = categories.filter(c => !sameCategoryId(c.id, categoryId))
  const nextMaterials = materials.map(m =>
    sameCategoryId(m.categoryId, categoryId) ? { ...m, categoryId: target?.id ?? nextCategories[0]?.id } : m,
  )
  return {
    categories: nextCategories.length ? nextCategories : [createCategory(DEFAULT_CATEGORY_NAME)],
    materials: nextMaterials,
  }
}

export function moveMaterial(materials, categories, matId, toCategoryId, toIndex = 999) {
  const mat = materials.find(m => m.id === matId)
  if (!mat) return materials
  const targetCat = findCategoryById(categories, toCategoryId)
  if (!targetCat) return materials

  const rest = materials.filter(m => m.id !== matId)
  const updated = { ...mat, categoryId: targetCat.id }

  const groups = groupMaterialsByCategory(categories, rest)
  const flat = []
  let inserted = false

  for (const g of groups) {
    if (sameCategoryId(g.category.id, targetCat.id)) {
      const items = [...g.items]
      const idx = toIndex === 999 ? items.length : Math.min(Math.max(toIndex, 0), items.length)
      items.splice(idx, 0, updated)
      flat.push(...items)
      inserted = true
    } else {
      flat.push(...g.items)
    }
  }

  if (!inserted) {
    const catIdx = categories.findIndex(c => sameCategoryId(c.id, targetCat.id))
    const result = []
    let done = false
    for (const g of groups) {
      const gIdx = categories.findIndex(c => sameCategoryId(c.id, g.category.id))
      if (!done && gIdx > catIdx) {
        result.push(updated)
        done = true
      }
      result.push(...g.items)
    }
    if (!done) result.push(updated)
    return result
  }

  return flat
}

/** Insert a new material at the end of its target category (preserves category order in flat list). */
export function insertMaterialAtCategory(materials, categories, material, toIndex = 999) {
  return moveMaterial([...materials, material], categories, material.id, material.categoryId, toIndex)
}

export function boqRowsToCategorizedMaterials(rows = []) {
  const categories = []
  const materials = []
  for (const r of rows.filter(row => row.desc?.trim())) {
    const name = inferMaterialCategory(r.desc, r.section)
    const { categories: cats, categoryId } = findOrCreateCategory(categories, name)
    categories.splice(0, categories.length, ...cats)
    materials.push({
      id: r.id ?? Date.now() + materials.length,
      categoryId,
      desc: r.desc,
      unit: r.unit || 'nr',
      qty: String(r.qty ?? ''),
      rate: r.clientSupplied ? '0' : String(r.rate ?? ''),
      amount: String(r.amount ?? ''),
      clientSupply: Boolean(r.clientSupplied),
    })
  }
  return normalizeMaterialState(materials, categories)
}
