import { createSupabaseServerClient, isSupabaseServerConfigured, formatSupabaseError } from './supabaseServer.js'
import { priceProfileItemToRow, rowToPriceProfileItem, profileToRow, rowToProfile } from './priceProfileMapper.js'

export async function fetchPriceProfilesFromCloud(env = process.env) {
  if (!isSupabaseServerConfigured(env)) {
    return { state: null, error: 'Supabase not configured' }
  }
  const supabase = createSupabaseServerClient(env)
  if (!supabase) return { state: null, error: 'Supabase not initialized' }

  const { data: profiles, error: pErr } = await supabase
    .from('price_profiles')
    .select('*')
    .order('updated_at', { ascending: false })

  if (pErr) return { state: null, error: formatSupabaseError(pErr) }

  const { data: items, error: iErr } = await supabase
    .from('price_profile_items')
    .select('*')
    .order('updated_at', { ascending: false })

  if (iErr) return { state: null, error: formatSupabaseError(iErr) }

  const itemsByProfile = new Map()
  for (const row of items || []) {
    const list = itemsByProfile.get(row.profile_id) || []
    list.push(rowToPriceProfileItem(row))
    itemsByProfile.set(row.profile_id, list)
  }

  const mapped = (profiles || []).map(row => rowToProfile(row, itemsByProfile.get(row.id) || []))
  const active = (profiles || []).find(p => p.is_active)

  return {
    state: {
      version: 2,
      activeProfileId: active?.id || mapped[0]?.id || 'default',
      profiles: mapped.length ? mapped : null,
    },
    error: null,
  }
}

export async function upsertPriceProfilesToCloud(state, env = process.env) {
  if (!isSupabaseServerConfigured(env)) {
    return { ok: false, error: 'Supabase not configured' }
  }
  const supabase = createSupabaseServerClient(env)
  if (!supabase) return { ok: false, error: 'Supabase not initialized' }

  const profiles = state.profiles || []
  const profileRows = profiles.map(p => profileToRow({ ...p, isActive: p.id === state.activeProfileId }))
  const { error: pErr } = await supabase.from('price_profiles').upsert(profileRows, { onConflict: 'id' })
  if (pErr) return { ok: false, error: formatSupabaseError(pErr) }

  const itemRows = []
  for (const profile of profiles) {
    for (const item of profile.items || []) {
      itemRows.push(priceProfileItemToRow(item, profile))
    }
  }

  if (itemRows.length) {
    const { error: iErr } = await supabase.from('price_profile_items').upsert(itemRows, { onConflict: 'id' })
    if (iErr) return { ok: false, error: formatSupabaseError(iErr) }
  }

  return { ok: true, saved: profiles.length, items: itemRows.length }
}
