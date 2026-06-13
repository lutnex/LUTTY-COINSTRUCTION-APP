import { getSupabaseClient } from './client.js'
import { isSupabaseConfigured } from '../../config/env.js'
import { rowToDocument, documentToRow } from '../../../lib/savedDocumentMapper.js'
import { formatSupabaseError } from '../../../lib/supabaseServer.js'

export async function fetchCloudDocuments() {
  if (!isSupabaseConfigured()) return { docs: [], error: null }

  const supabase = getSupabaseClient()
  if (!supabase) return { docs: [], error: 'Supabase not initialized' }

  const { data, error } = await supabase
    .from('saved_documents')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) return { docs: [], error: formatSupabaseError(error) }
  return { docs: (data || []).map(rowToDocument).filter(Boolean), error: null }
}

export async function upsertCloudDocument(doc) {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Cloud save not configured' }

  const supabase = getSupabaseClient()
  if (!supabase) return { ok: false, error: 'Supabase not initialized' }

  const { error } = await supabase
    .from('saved_documents')
    .upsert(documentToRow(doc), { onConflict: 'id' })

  if (error) return { ok: false, error: formatSupabaseError(error) }
  return { ok: true, error: null }
}

/** Insert only — skips if the document id already exists in Supabase. */
export async function insertCloudDocument(doc) {
  if (!isSupabaseConfigured()) return { ok: false, skipped: false, error: 'Cloud save not configured' }

  const supabase = getSupabaseClient()
  if (!supabase) return { ok: false, skipped: false, error: 'Supabase not initialized' }

  const { error } = await supabase.from('saved_documents').insert(documentToRow(doc))

  if (error) {
    const duplicate = error.code === '23505' || /duplicate key|already exists/i.test(error.message)
    if (duplicate) return { ok: true, skipped: true, error: null }
    return { ok: false, skipped: false, error: formatSupabaseError(error) }
  }
  return { ok: true, skipped: false, error: null }
}

export async function deleteCloudDocument(id) {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Cloud save not configured' }

  const supabase = getSupabaseClient()
  if (!supabase) return { ok: false, error: 'Supabase not initialized' }

  const { error } = await supabase.from('saved_documents').delete().eq('id', id)
  if (error) return { ok: false, error: formatSupabaseError(error) }
  return { ok: true, error: null }
}
