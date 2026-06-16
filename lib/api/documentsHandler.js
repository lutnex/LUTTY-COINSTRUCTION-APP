import {
  checkSupabaseServerHealth,
  fetchServerDocuments,
  upsertServerDocument,
  deleteServerDocument,
  importDocumentsToSupabase,
  parseImportDocuments,
  isSupabaseServerConfigured,
  formatSupabaseError,
} from '../supabaseServer.js'
import { readJsonBody, setNoStore } from './http.js'

export async function handleDocumentsRequest(req, res, env = process.env, action) {
  setNoStore(res)

  switch (action) {
    case 'health':
      return handleHealth(req, res, env)
    case 'list':
      return handleList(req, res, env)
    case 'save':
      return handleSave(req, res, env)
    case 'delete':
      return handleDelete(req, res, env)
    case 'import':
      return handleImport(req, res, env)
    default:
      return res.status(404).json({ ok: false, error: `Unknown documents action: ${action}` })
  }
}

async function handleHealth(req, res, env) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }
  if (!isSupabaseServerConfigured(env)) {
    return res.status(503).json({
      ok: false,
      configured: false,
      message: 'Supabase is not configured on the server. Set SUPABASE_URL and SUPABASE_ANON_KEY in environment variables.',
      statusLabel: 'Local Save Only',
    })
  }
  const result = await checkSupabaseServerHealth(env)
  return res.status(result.ok ? 200 : 502).json(result)
}

async function handleList(req, res, env) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ docs: [], error: 'Method not allowed' })
  }
  if (!isSupabaseServerConfigured(env)) {
    return res.status(503).json({ docs: [], error: 'Supabase is not configured on the server' })
  }
  try {
    const { docs, error } = await fetchServerDocuments(env)
    if (error) return res.status(502).json({ docs: [], error })
    return res.status(200).json({ docs, error: null })
  } catch (err) {
    return res.status(502).json({
      docs: [],
      error: formatSupabaseError({ message: err instanceof Error ? err.message : 'Fetch failed' }),
    })
  }
}

async function handleSave(req, res, env) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }
  if (!isSupabaseServerConfigured(env)) {
    return res.status(503).json({ ok: false, error: 'Supabase is not configured on the server' })
  }
  try {
    const doc = await readJsonBody(req)
    if (!doc?.id || !doc?.name) {
      return res.status(400).json({ ok: false, error: 'Invalid document payload' })
    }
    const result = await upsertServerDocument(doc, env)
    return res.status(result.ok ? 200 : 502).json(result)
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: formatSupabaseError({ message: err instanceof Error ? err.message : 'Save failed' }),
    })
  }
}

async function handleDelete(req, res, env) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }
  if (!isSupabaseServerConfigured(env)) {
    return res.status(503).json({ ok: false, error: 'Supabase is not configured on the server' })
  }
  const id = req.query?.id || (typeof req.body === 'object' ? req.body?.id : null)
  if (!id) {
    return res.status(400).json({ ok: false, error: 'Document id is required' })
  }
  try {
    const result = await deleteServerDocument(id, env)
    return res.status(result.ok ? 200 : 502).json(result)
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: formatSupabaseError({ message: err instanceof Error ? err.message : 'Delete failed' }),
    })
  }
}

async function handleImport(req, res, env) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, errors: ['Method not allowed'] })
  }
  if (!isSupabaseServerConfigured(env)) {
    return res.status(503).json({
      ok: false,
      errors: [
        'Supabase is not configured on the server. Set SUPABASE_URL and SUPABASE_ANON_KEY in environment variables.',
      ],
    })
  }
  try {
    const payload = await readJsonBody(req)
    const docs = parseImportDocuments(payload)
    if (!docs.length) {
      return res.status(400).json({ ok: false, errors: ['No valid documents found in backup file'] })
    }
    const result = await importDocumentsToSupabase(docs, env)
    return res.status(result.ok ? 200 : 502).json(result)
  } catch (err) {
    console.error('[api/documents/import] failed:', err)
    return res.status(400).json({
      ok: false,
      errors: [formatSupabaseError({ message: err instanceof Error ? err.message : 'Import failed' })],
    })
  }
}
