import {
  fetchServerDocuments,
  isSupabaseServerConfigured,
  formatSupabaseError,
} from '../../lib/supabaseServer.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ docs: [], error: 'Method not allowed' })
  }

  if (!isSupabaseServerConfigured()) {
    return res.status(503).json({
      docs: [],
      error: 'Supabase is not configured on the server',
    })
  }

  try {
    const { docs, error } = await fetchServerDocuments()
    if (error) {
      return res.status(502).json({ docs: [], error })
    }
    return res.status(200).json({ docs, error: null })
  } catch (err) {
    return res.status(502).json({
      docs: [],
      error: formatSupabaseError({ message: err instanceof Error ? err.message : 'Fetch failed' }),
    })
  }
}
