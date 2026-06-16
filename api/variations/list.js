import { isSupabaseServerConfigured } from '../../lib/supabaseServer.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ orders: [], error: 'Method not allowed' })
  }

  if (!isSupabaseServerConfigured()) {
    return res.status(503).json({ orders: [], error: 'Supabase is not configured' })
  }

  const { fetchServerVariationOrders } = await import('../../lib/variationOrderServer.js')
  const { orders, error } = await fetchServerVariationOrders()
  return res.status(error ? 502 : 200).json({ orders, error })
}
