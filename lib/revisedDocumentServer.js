import { createSupabaseServerClient, formatSupabaseError } from './supabaseServer.js'
import { revisedDocumentToRow, rowToRevisedDocument } from './revisedDocumentMapper.js'

const TABLE = 'revised_documents'

export async function upsertServerRevisedDocument(doc, env = process.env) {
  const supabase = createSupabaseServerClient(env)
  if (!supabase) return { ok: false, error: 'Supabase not initialized' }

  const { error } = await supabase
    .from(TABLE)
    .upsert(revisedDocumentToRow(doc), { onConflict: 'id' })

  if (error) return { ok: false, error: formatSupabaseError(error, TABLE) }
  return { ok: true, error: null }
}

export async function fetchServerRevisedDocuments(env = process.env) {
  const supabase = createSupabaseServerClient(env)
  if (!supabase) return { docs: [], error: 'Supabase not initialized' }

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) return { docs: [], error: formatSupabaseError(error, TABLE) }
  return { docs: (data || []).map(rowToRevisedDocument).filter(Boolean), error: null }
}

export async function deleteServerRevisedDocument(id, env = process.env) {
  const supabase = createSupabaseServerClient(env)
  if (!supabase) return { ok: false, error: 'Supabase not initialized' }

  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) return { ok: false, error: formatSupabaseError(error, TABLE) }
  return { ok: true, error: null }
}
