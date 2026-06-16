import {
  fetchServerVariationOrders,
  upsertServerVariationOrder,
  deleteServerVariationOrder,
} from '../variationOrderServer.js'
import { isSupabaseServerConfigured, formatSupabaseError } from '../supabaseServer.js'
import { readJsonBody, setNoStore } from './http.js'

export async function handleVariationOrdersRequest(req, res, env = process.env, action) {
  setNoStore(res)

  switch (action) {
    case 'list':
      return handleList(req, res, env)
    case 'save':
      return handleSave(req, res, env)
    case 'delete':
      return handleDelete(req, res, env)
    default:
      return res.status(404).json({ ok: false, error: `Unknown variation action: ${action}` })
  }
}

async function handleList(req, res, env) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ orders: [], error: 'Method not allowed' })
  }
  if (!isSupabaseServerConfigured(env)) {
    return res.status(503).json({ orders: [], error: 'Supabase is not configured on the server' })
  }
  const { orders, error } = await fetchServerVariationOrders(env)
  return res.status(error ? 502 : 200).json({ orders, error })
}

async function handleSave(req, res, env) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }
  if (!isSupabaseServerConfigured(env)) {
    return res.status(503).json({ ok: false, error: 'Supabase is not configured on the server' })
  }
  try {
    const vo = await readJsonBody(req)
    if (!vo?.id || !vo?.variationNumber) {
      return res.status(400).json({ ok: false, error: 'Invalid variation order payload' })
    }
    const result = await upsertServerVariationOrder(vo, env)
    return res.status(result.ok ? 200 : 502).json(result)
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: formatSupabaseError({ message: err instanceof Error ? err.message : 'Save failed' }),
    })
  }
}

async function handleDelete(req, res, env) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }
  if (!isSupabaseServerConfigured(env)) {
    return res.status(503).json({ ok: false, error: 'Supabase is not configured on the server' })
  }
  const id = req.query?.id
  if (!id) {
    return res.status(400).json({ ok: false, error: 'Variation order id is required' })
  }
  const result = await deleteServerVariationOrder(id, env)
  return res.status(result.ok ? 200 : 502).json(result)
}
