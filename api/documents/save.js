import {
  upsertServerDocument,
  isSupabaseServerConfigured,
  formatSupabaseError,
} from '../../lib/supabaseServer.js'

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function getRequestBody(req) {
  const body = req.body
  if (body != null && body !== '') {
    if (Buffer.isBuffer(body)) return JSON.parse(body.toString('utf8'))
    if (typeof body === 'string') return JSON.parse(body)
    if (typeof body === 'object') return body
  }
  const raw = await readRawBody(req)
  if (!raw.length) return null
  return JSON.parse(raw.toString('utf8'))
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  if (!isSupabaseServerConfigured()) {
    return res.status(503).json({ ok: false, error: 'Supabase is not configured on the server' })
  }

  try {
    const doc = await getRequestBody(req)
    if (!doc?.id || !doc?.name) {
      return res.status(400).json({ ok: false, error: 'Invalid document payload' })
    }

    const result = await upsertServerDocument(doc)
    return res.status(result.ok ? 200 : 502).json(result)
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: formatSupabaseError({ message: err instanceof Error ? err.message : 'Save failed' }),
    })
  }
}
