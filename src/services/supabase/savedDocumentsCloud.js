import { getSupabaseClient } from './client.js'
import { isSupabaseConfigured } from '../../config/env.js'

function rowToDocument(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    projectName: row.project_name || '',
    category: row.category || 'other',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    contractSum: Number(row.contract_sum) || 0,
    previewHtml: row.preview_html || null,
    snapshot: row.snapshot || {},
  }
}

function documentToRow(doc) {
  const meta = doc.snapshot?.meta || {}
  return {
    id: doc.id,
    name: doc.name,
    project_name: doc.projectName || meta.projectTitle || '',
    category: doc.category || 'other',
    client_name: meta.clientName || '',
    client_contact: meta.clientContact || '',
    client_email: meta.clientEmail || '',
    project_location: meta.projectLocation || '',
    project_title: meta.projectTitle || '',
    contract_sum: doc.contractSum || doc.snapshot?.contractSum || 0,
    preview_html: doc.previewHtml || doc.snapshot?.previewHtml || null,
    snapshot: doc.snapshot,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }
}

export async function fetchCloudDocuments() {
  if (!isSupabaseConfigured()) return { docs: [], error: null }

  const supabase = getSupabaseClient()
  if (!supabase) return { docs: [], error: 'Supabase not initialized' }

  const { data, error } = await supabase
    .from('saved_documents')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) return { docs: [], error: error.message }
  return { docs: (data || []).map(rowToDocument).filter(Boolean), error: null }
}

export async function upsertCloudDocument(doc) {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Cloud save not configured' }

  const supabase = getSupabaseClient()
  if (!supabase) return { ok: false, error: 'Supabase not initialized' }

  const { error } = await supabase
    .from('saved_documents')
    .upsert(documentToRow(doc), { onConflict: 'id' })

  if (error) return { ok: false, error: error.message }
  return { ok: true, error: null }
}

export async function deleteCloudDocument(id) {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Cloud save not configured' }

  const supabase = getSupabaseClient()
  if (!supabase) return { ok: false, error: 'Supabase not initialized' }

  const { error } = await supabase.from('saved_documents').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true, error: null }
}
