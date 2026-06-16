import { getSupabaseClient } from './client.js'
import { isSupabaseConfigured } from '../../config/env.js'
import { rowToVariationOrder, variationOrderToRow } from '../../../lib/variationOrderMapper.js'
import { formatSupabaseError } from '../../../lib/supabaseServer.js'

async function fetchFromServer(path, options = {}) {
  const response = await fetch(path, {
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const data = await response.json().catch(() => null)
  return { response, data }
}

export async function fetchCloudVariationOrders() {
  try {
    const { response, data } = await fetchFromServer('/api/variations/list')
    if (response.ok && data && !data.error) {
      return { orders: data.orders || [], error: null }
    }
    if (response.status !== 404 && data?.error) {
      return { orders: [], error: data.error }
    }
  } catch {
    // fall through to direct client
  }

  if (!isSupabaseConfigured()) return { orders: [], error: null }

  const supabase = getSupabaseClient()
  if (!supabase) return { orders: [], error: 'Supabase not initialized' }

  const { data, error } = await supabase
    .from('variation_orders')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) return { orders: [], error: formatSupabaseError(error) }
  return { orders: (data || []).map(rowToVariationOrder).filter(Boolean), error: null }
}

export async function upsertCloudVariationOrder(vo) {
  try {
    const { response, data } = await fetchFromServer('/api/variations/save', {
      method: 'POST',
      body: JSON.stringify(vo),
    })
    if (response.ok && data?.ok) return { ok: true, error: null }
    if (response.status !== 404 && data?.error) {
      return { ok: false, error: data.error }
    }
  } catch {
    // fall through
  }

  if (!isSupabaseConfigured()) return { ok: false, error: 'Cloud save not configured' }

  const supabase = getSupabaseClient()
  if (!supabase) return { ok: false, error: 'Supabase not initialized' }

  const { error } = await supabase
    .from('variation_orders')
    .upsert(variationOrderToRow(vo), { onConflict: 'id' })

  if (error) return { ok: false, error: formatSupabaseError(error) }
  return { ok: true, error: null }
}

export async function deleteCloudVariationOrder(id) {
  try {
    const { response, data } = await fetchFromServer(`/api/variations/delete?id=${encodeURIComponent(id)}`, {
      method: 'POST',
    })
    if (response.ok && data?.ok) return { ok: true, error: null }
    if (response.status !== 404 && data?.error) {
      return { ok: false, error: data.error }
    }
  } catch {
    // fall through
  }

  if (!isSupabaseConfigured()) return { ok: false, error: 'Cloud save not configured' }

  const supabase = getSupabaseClient()
  if (!supabase) return { ok: false, error: 'Supabase not initialized' }

  const { error } = await supabase.from('variation_orders').delete().eq('id', id)
  if (error) return { ok: false, error: formatSupabaseError(error) }
  return { ok: true, error: null }
}
