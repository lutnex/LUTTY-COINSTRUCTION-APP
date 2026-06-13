import { loadPriceProfileState, savePriceProfileState } from '../utils/priceStore.js'

export async function fetchPriceProfilesCloud() {
  try {
    const res = await fetch('/api/prices/list', { cache: 'no-store' })
    const data = await res.json().catch(() => null)
    if (res.ok && data?.state?.profiles?.length) {
      return { state: data.state, error: null, cloudActive: true }
    }
    return { state: null, error: data?.error || null, cloudActive: false }
  } catch (err) {
    return { state: null, error: err instanceof Error ? err.message : 'Fetch failed', cloudActive: false }
  }
}

export async function savePriceProfilesCloud(state) {
  try {
    const res = await fetch('/api/prices/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
    })
    const data = await res.json().catch(() => null)
    return {
      ok: Boolean(data?.ok),
      error: data?.error || null,
      warning: data?.warning || null,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Save failed' }
  }
}

/** Load local first, merge cloud if newer/more complete. */
export async function loadAllPriceProfiles() {
  const local = loadPriceProfileState()
  const { state: cloud, error, cloudActive } = await fetchPriceProfilesCloud()
  if (!cloudActive || !cloud?.profiles?.length) {
    return { state: local, cloudActive: false, error }
  }
  const cloudItems = cloud.profiles.reduce((n, p) => n + (p.items?.length || 0), 0)
  const localItems = local.profiles.reduce((n, p) => n + (p.items?.length || 0), 0)
  if (cloudItems >= localItems) {
    savePriceProfileState(cloud)
    return { state: cloud, cloudActive: true, error: null }
  }
  return { state: local, cloudActive: true, error: null }
}

export async function persistPriceProfiles(state) {
  savePriceProfileState(state)
  const cloud = await savePriceProfilesCloud(state)
  return cloud
}
