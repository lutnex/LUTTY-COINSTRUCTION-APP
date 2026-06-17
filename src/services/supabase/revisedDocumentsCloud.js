import { getSupabaseClient } from './client.js'
import { isSupabaseConfigured } from '../../config/env.js'
import {
  revisedDocumentToRow,
  rowToRevisedDocument,
} from '../../../lib/revisedDocumentMapper.js'
import { formatSupabaseError } from '../../../lib/supabaseServer.js'

const TABLE = 'revised_documents'

async function fetchFromServer(path, options = {}) {
  const response = await fetch(path, {
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const data = await response.json().catch(() => null)
  return { response, data }
}

export async function upsertCloudRevisedDocument(doc) {
  try {
    const { response, data } = await fetchFromServer('/api/revised/save', {
      method: 'POST',
      body: JSON.stringify(doc),
    })
    if (response.ok && data?.ok) return { ok: true, error: null }
    if (response.status !== 404 && data?.error) {
      return { ok: false, error: data.error }
    }
  } catch {
    // fall through to direct client
  }

  if (!isSupabaseConfigured()) return { ok: false, error: 'Cloud save not configured' }

  const supabase = getSupabaseClient()
  if (!supabase) return { ok: false, error: 'Supabase not initialized' }

  const { error } = await supabase
    .from(TABLE)
    .upsert(revisedDocumentToRow(doc), { onConflict: 'id' })

  if (error) return { ok: false, error: formatSupabaseError(error, TABLE) }
  return { ok: true, error: null }
}

export async function fetchCloudRevisedDocuments() {
  try {
    const { response, data } = await fetchFromServer('/api/revised/list')
    if (response.ok && data && !data.error) {
      return { docs: data.docs || [], error: null }
    }
    if (response.status !== 404 && data?.error) {
      return { docs: [], error: data.error }
    }
  } catch {
    // fall through
  }

  if (!isSupabaseConfigured()) return { docs: [], error: null }

  const supabase = getSupabaseClient()
  if (!supabase) return { docs: [], error: 'Supabase not initialized' }

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) return { docs: [], error: formatSupabaseError(error, TABLE) }
  return { docs: (data || []).map(rowToRevisedDocument).filter(Boolean), error: null }
}
