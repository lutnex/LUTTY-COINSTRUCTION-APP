import { fetchPriceProfilesFromCloud, upsertPriceProfilesToCloud } from '../../lib/priceProfileServer.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }
  const result = await fetchPriceProfilesFromCloud()
  if (!result.state) {
    return res.status(200).json({ ok: false, state: null, error: result.error })
  }
  return res.status(200).json({ ok: true, state: result.state })
}
