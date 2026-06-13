import { searchAllMaterialPrices } from '../../lib/materialPriceSearch.js'
import { isSupabaseServerConfigured } from '../../lib/supabaseServer.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, errors: ['Method not allowed'] })
  }

  const refresh = req.body?.refresh !== false
  const result = await searchAllMaterialPrices({ refresh })

  if (!isSupabaseServerConfigured() && result.prices.length) {
    return res.status(200).json({
      ...result,
      warning: 'Supabase not configured — prices returned from search only, not persisted',
    })
  }

  return res.status(result.ok ? 200 : 207).json(result)
}
