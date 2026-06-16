import { createSupabaseServerClient, formatSupabaseError } from './supabaseServer.js'
import { variationOrderToRow, rowToVariationOrder } from './variationOrderMapper.js'

export async function fetchServerVariationOrders(env = process.env) {
  const supabase = createSupabaseServerClient(env)
  if (!supabase) return { orders: [], error: 'Supabase not initialized' }

  const { data, error } = await supabase
    .from('variation_orders')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) return { orders: [], error: formatSupabaseError(error) }
  return { orders: (data || []).map(rowToVariationOrder).filter(Boolean), error: null }
}

export async function upsertServerVariationOrder(vo, env = process.env) {
  const supabase = createSupabaseServerClient(env)
  if (!supabase) return { ok: false, error: 'Supabase not initialized' }

  const { error } = await supabase
    .from('variation_orders')
    .upsert(variationOrderToRow(vo), { onConflict: 'id' })

  if (error) return { ok: false, error: formatSupabaseError(error) }
  return { ok: true, error: null }
}

export async function deleteServerVariationOrder(id, env = process.env) {
  const supabase = createSupabaseServerClient(env)
  if (!supabase) return { ok: false, error: 'Supabase not initialized' }

  const { error } = await supabase.from('variation_orders').delete().eq('id', id)
  if (error) return { ok: false, error: formatSupabaseError(error) }
  return { ok: true, error: null }
}
