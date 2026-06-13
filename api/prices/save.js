import { upsertPriceProfilesToCloud } from '../../lib/priceProfileServer.js'
import { isSupabaseServerConfigured } from '../../lib/supabaseServer.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const state = req.body?.state
  if (!state?.profiles?.length) {
    return res.status(400).json({ ok: false, error: 'Invalid price profile state' })
  }

  const result = await upsertPriceProfilesToCloud(state)
  if (!isSupabaseServerConfigured() && result.ok) {
    return res.status(200).json({ ...result, warning: 'Supabase not configured — saved locally only' })
  }
  return res.status(result.ok ? 200 : 500).json(result)
}
