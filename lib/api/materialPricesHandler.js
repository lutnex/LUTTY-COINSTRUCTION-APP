import { fetchCachedMaterialPrices, searchAllMaterialPrices } from '../materialPriceSearch.js'
import { fetchPriceProfilesFromCloud, upsertPriceProfilesToCloud } from '../priceProfileServer.js'
import { isSupabaseServerConfigured } from '../supabaseServer.js'
import { readJsonBody, setNoStore } from './http.js'

export async function handleMaterialPricesRequest(req, res, env = process.env, resource, action) {
  setNoStore(res)

  if (resource === 'materials') {
    switch (action) {
      case 'list':
        return handleMaterialsList(req, res, env)
      case 'search':
        return handleMaterialsSearch(req, res, env)
      default:
        return res.status(404).json({ ok: false, error: `Unknown materials action: ${action}` })
    }
  }

  if (resource === 'prices') {
    switch (action) {
      case 'list':
        return handlePricesList(req, res, env)
      case 'save':
        return handlePricesSave(req, res, env)
      default:
        return res.status(404).json({ ok: false, error: `Unknown prices action: ${action}` })
    }
  }

  return res.status(404).json({ ok: false, error: `Unknown resource: ${resource}` })
}

async function handleMaterialsList(req, res, env) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ ok: false, prices: [], error: 'Method not allowed' })
  }
  const { prices, error } = await fetchCachedMaterialPrices(env)
  if (error) return res.status(502).json({ ok: false, prices: [], error })
  return res.status(200).json({ ok: true, prices, error: null })
}

async function handleMaterialsSearch(req, res, env) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, errors: ['Method not allowed'] })
  }
  try {
    const body = (await readJsonBody(req)) || {}
    const refresh = body.refresh !== false
    const result = await searchAllMaterialPrices({ refresh }, env)
    if (!isSupabaseServerConfigured(env) && result.prices?.length) {
      return res.status(200).json({
        ...result,
        warning: 'Supabase not configured — prices returned from search only, not persisted',
      })
    }
    return res.status(result.ok ? 200 : 207).json(result)
  } catch (err) {
    return res.status(500).json({
      ok: false,
      errors: [err instanceof Error ? err.message : 'Search failed'],
    })
  }
}

async function handlePricesList(req, res, env) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }
  const result = await fetchPriceProfilesFromCloud(env)
  if (!result.state) {
    return res.status(200).json({ ok: false, state: null, error: result.error })
  }
  return res.status(200).json({ ok: true, state: result.state })
}

async function handlePricesSave(req, res, env) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }
  try {
    const body = await readJsonBody(req)
    const state = body?.state
    if (!state?.profiles?.length) {
      return res.status(400).json({ ok: false, error: 'Invalid price profile state' })
    }
    const result = await upsertPriceProfilesToCloud(state, env)
    if (!isSupabaseServerConfigured(env) && result.ok) {
      return res.status(200).json({ ...result, warning: 'Supabase not configured — saved locally only' })
    }
    return res.status(result.ok ? 200 : 500).json(result)
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Save failed',
    })
  }
}
