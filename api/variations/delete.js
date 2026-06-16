import {
  isSupabaseServerConfigured,
  formatSupabaseError,
} from '../../lib/supabaseServer.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  if (!isSupabaseServerConfigured()) {
    return res.status(503).json({ ok: false, error: 'Supabase is not configured' })
  }

  const id = req.query?.id || new URL(req.url, 'http://localhost').searchParams.get('id')
  if (!id) {
    return res.status(400).json({ ok: false, error: 'Variation order id is required' })
  }

  const { deleteServerVariationOrder } = await import('../../lib/variationOrderServer.js')
  const result = await deleteServerVariationOrder(id)
  return res.status(result.ok ? 200 : 502).json(result)
}
