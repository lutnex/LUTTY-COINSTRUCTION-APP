import { fetchCachedMaterialPrices } from '../../lib/materialPriceSearch.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ ok: false, prices: [], error: 'Method not allowed' })
  }

  const { prices, error } = await fetchCachedMaterialPrices()
  if (error) return res.status(502).json({ ok: false, prices: [], error })
  return res.status(200).json({ ok: true, prices, error: null })
}
