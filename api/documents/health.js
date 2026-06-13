import {
  checkSupabaseServerHealth,
  isSupabaseServerConfigured,
} from '../../lib/supabaseServer.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }

  if (!isSupabaseServerConfigured()) {
    return res.status(503).json({
      ok: false,
      configured: false,
      message: 'Supabase is not configured on the server. Set SUPABASE_URL and SUPABASE_ANON_KEY in environment variables.',
      statusLabel: 'Local Save Only',
    })
  }

  const result = await checkSupabaseServerHealth()
  return res.status(result.ok ? 200 : 502).json(result)
}
