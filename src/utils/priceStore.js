import { DEFAULT_PRICES } from './constants.js'
import { PRICE_ITEM_SOURCES } from './priceProfileTypes.js'

export const PRICE_STORAGE_KEY = 'constructiq-price-profiles'

const DEFAULT_PROFILE_ID = 'default'

function normalizeItem(p, i = 0) {
  return {
    id: p.id ?? Date.now() + i + Math.random(),
    material: String(p.material || p.name || '').trim(),
    specification: String(p.specification || p.spec || '').trim(),
    unit: String(p.unit || 'nr').trim(),
    price: String(p.price ?? ''),
    currency: p.currency || 'GHS',
    category: p.category || 'material',
    supplier: String(p.supplier || '').trim(),
    supplierUrl: String(p.supplierUrl || p.supplier_url || '').trim(),
    location: String(p.location || '').trim(),
    lastUpdated: p.lastUpdated || p.last_updated || new Date().toISOString().slice(0, 10),
    source: p.source || PRICE_ITEM_SOURCES.MANUAL,
    notes: String(p.notes || '').trim(),
    history: Array.isArray(p.history) ? p.history : [],
  }
}

function defaultProfile() {
  return {
    id: DEFAULT_PROFILE_ID,
    name: 'Default Profile',
    createdAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().slice(0, 10),
    items: DEFAULT_PRICES.map((p, i) => normalizeItem({ ...p, source: PRICE_ITEM_SOURCES.MANUAL }, i)),
  }
}

function migrateV1FlatArray(parsed) {
  return {
    version: 2,
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: [{
      ...defaultProfile(),
      items: parsed.map((p, i) => normalizeItem(p, i)),
    }],
  }
}

export function loadPriceProfileState() {
  try {
    const raw = localStorage.getItem(PRICE_STORAGE_KEY)
    if (!raw) return { version: 2, activeProfileId: DEFAULT_PROFILE_ID, profiles: [defaultProfile()] }
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return migrateV1FlatArray(parsed)
    if (!parsed?.profiles?.length) return { version: 2, activeProfileId: DEFAULT_PROFILE_ID, profiles: [defaultProfile()] }
    return {
      version: 2,
      activeProfileId: parsed.activeProfileId || parsed.profiles[0].id,
      profiles: parsed.profiles.map(p => ({
        id: p.id || DEFAULT_PROFILE_ID,
        name: p.name || 'Profile',
        createdAt: p.createdAt || today(),
        updatedAt: p.updatedAt || today(),
        items: (p.items || []).map((it, i) => normalizeItem(it, i)).filter(it => it.material),
      })),
    }
  } catch {
    return { version: 2, activeProfileId: DEFAULT_PROFILE_ID, profiles: [defaultProfile()] }
  }
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function savePriceProfileState(state) {
  try {
    localStorage.setItem(PRICE_STORAGE_KEY, JSON.stringify({
      ...state,
      version: 2,
      profiles: state.profiles.map(p => ({
        ...p,
        updatedAt: today(),
      })),
    }))
    return true
  } catch (e) {
    console.error('[priceStore] save failed', e)
    return false
  }
}

/** Backward-compatible flat list from active profile. */
export function loadPriceProfiles() {
  return getActiveProfileItems(loadPriceProfileState())
}

export function savePriceProfiles(prices = []) {
  const state = loadPriceProfileState()
  const next = updateActiveProfileItems(state, prices)
  return savePriceProfileState(next)
}

export function getActiveProfile(state) {
  return state.profiles.find(p => p.id === state.activeProfileId) || state.profiles[0]
}

export function getActiveProfileItems(state) {
  return getActiveProfile(state)?.items || []
}

export function updateActiveProfileItems(state, items) {
  const activeId = state.activeProfileId
  return {
    ...state,
    profiles: state.profiles.map(p => p.id === activeId
      ? { ...p, items: (typeof items === 'function' ? items(p.items) : items).map((it, i) => normalizeItem(it, i)).filter(it => it.material), updatedAt: today() }
      : p),
  }
}

export function setActiveProfileId(state, profileId) {
  if (!state.profiles.some(p => p.id === profileId)) return state
  return { ...state, activeProfileId: profileId }
}

export function createProfile(state, name) {
  const id = `profile-${Date.now()}`
  const profile = {
    id,
    name: name?.trim() || `Profile ${state.profiles.length + 1}`,
    createdAt: today(),
    updatedAt: today(),
    items: [],
  }
  return { ...state, profiles: [...state.profiles, profile], activeProfileId: id }
}

export function renameProfile(state, profileId, name) {
  return {
    ...state,
    profiles: state.profiles.map(p => p.id === profileId ? { ...p, name: name.trim(), updatedAt: today() } : p),
  }
}

export function deleteProfile(state, profileId) {
  if (state.profiles.length <= 1) return state
  const profiles = state.profiles.filter(p => p.id !== profileId)
  const activeProfileId = state.activeProfileId === profileId ? profiles[0].id : state.activeProfileId
  return { ...state, profiles, activeProfileId }
}

function itemMatchKey(item) {
  return `${item.material}|${item.specification || ''}|${item.unit || ''}`.toLowerCase()
}

export function findProfileItem(items, { material, specification, unit } = {}) {
  const needle = `${material || ''} ${specification || ''}`.toLowerCase().trim()
  if (!needle) return null
  return items.find(p => {
    const hay = `${p.material} ${p.specification || ''}`.toLowerCase()
    const unitMatch = !unit || !p.unit || p.unit === unit
    return unitMatch && (hay.includes(needle) || needle.includes(p.material.toLowerCase()))
  }) || null
}

/** @deprecated use findProfileItem */
export function findSavedPrice(prices, opts) {
  return findProfileItem(prices, opts)
}

export function detectProfileConflicts(profileItems = [], incoming = []) {
  const conflicts = []
  for (const item of incoming) {
    const existing = findProfileItem(profileItems, item)
    if (!existing?.price) continue
    const oldP = parseFloat(existing.price)
    const newP = parseFloat(item.price)
    if (!Number.isFinite(oldP) || !Number.isFinite(newP)) continue
    if (Math.abs(oldP - newP) < 0.01) continue
    conflicts.push({
      incoming: item,
      existing,
      difference: Math.round((newP - oldP) * 100) / 100,
    })
  }
  return conflicts
}

export function mergeItemsIntoProfile(profileItems = [], incoming = [], { mode = 'skip' } = {}) {
  // mode: skip | replace | keep_both
  const next = [...profileItems]
  for (const item of incoming) {
    const idx = next.findIndex(p => itemMatchKey(p) === itemMatchKey(item))
    if (idx < 0) {
      next.push(normalizeItem(item, next.length))
      continue
    }
    if (mode === 'skip') continue
    if (mode === 'keep_both') {
      const hist = [...(next[idx].history || []), {
        price: next[idx].price,
        lastUpdated: next[idx].lastUpdated,
        source: next[idx].source,
      }]
      next[idx] = normalizeItem({ ...next[idx], ...item, history: hist }, idx)
      continue
    }
    next[idx] = normalizeItem({ ...next[idx], ...item, history: next[idx].history }, idx)
  }
  return next
}

export function addItemsToProfile(state, profileId, items, conflictMode = 'replace') {
  return {
    ...state,
    profiles: state.profiles.map(p => {
      if (p.id !== profileId) return p
      return {
        ...p,
        items: mergeItemsIntoProfile(p.items, items, { mode: conflictMode }),
        updatedAt: today(),
      }
    }),
  }
}
