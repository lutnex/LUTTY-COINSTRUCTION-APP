import {
  upsertServerRevisedDocument,
  fetchServerRevisedDocuments,
  deleteServerRevisedDocument,
} from '../revisedDocumentServer.js'
import { isSupabaseServerConfigured, formatSupabaseError } from '../supabaseServer.js'
import { readJsonBody, setNoStore } from './http.js'

export async function handleRevisedDocumentsRequest(req, res, env = process.env, action) {
  setNoStore(res)

  switch (action) {
    case 'list':
      return handleList(req, res, env)
    case 'save':
      return handleSave(req, res, env)
    case 'delete':
      return handleDelete(req, res, env)
    default:
      return res.status(404).json({ ok: false, error: `Unknown revised document action: ${action}` })
  }
}

async function handleList(req, res, env) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ docs: [], error: 'Method not allowed' })
  }
  if (!isSupabaseServerConfigured(env)) {
    return res.status(503).json({ docs: [], error: 'Supabase is not configured on the server' })
  }
  const { docs, error } = await fetchServerRevisedDocuments(env)
  return res.status(error ? 502 : 200).json({ docs, error })
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
    if (!doc?.id || !doc?.variationNumber) {
      return res.status(400).json({ ok: false, error: 'Invalid revised document payload' })
    }
    const result = await upsertServerRevisedDocument(doc, env)
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
  const id = req.query?.id
  if (!id) {
    return res.status(400).json({ ok: false, error: 'Revised document id is required' })
  }
  const result = await deleteServerRevisedDocument(id, env)
  return res.status(result.ok ? 200 : 502).json(result)
}
