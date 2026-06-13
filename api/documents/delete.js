import {
  deleteServerDocument,
  isSupabaseServerConfigured,
  formatSupabaseError,
} from '../../lib/supabaseServer.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  if (!isSupabaseServerConfigured()) {
    return res.status(503).json({ ok: false, error: 'Supabase is not configured on the server' })
  }

  const id = req.query?.id || req.body?.id
  if (!id) {
    return res.status(400).json({ ok: false, error: 'Document id is required' })
  }

  try {
    const result = await deleteServerDocument(id)
    return res.status(result.ok ? 200 : 502).json(result)
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: formatSupabaseError({ message: err instanceof Error ? err.message : 'Delete failed' }),
    })
  }
}
