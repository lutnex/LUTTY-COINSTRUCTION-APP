import {
  loadSavedDocuments,
  persistSavedDocuments,
  createSavedDocument,
  getSavedDocument,
  saveDocument,
} from '../utils/savedDocuments.js'
import {
  fetchCloudDocuments,
  upsertCloudDocument,
  deleteCloudDocument,
} from './supabase/savedDocumentsCloud.js'
import { checkSupabaseConnection } from './supabase/client.js'
import { isSupabaseConfigured } from '../config/env.js'

export const CLOUD_WARNING =
  'Cloud saving is not configured. Documents are only saved on this device.'

/** Merge cloud + local docs; cloud wins on id conflict (newer updatedAt). */
function mergeDocuments(cloudDocs, localDocs) {
  const byId = new Map()
  for (const doc of localDocs) byId.set(doc.id, doc)
  for (const doc of cloudDocs) {
    const existing = byId.get(doc.id)
    if (!existing || new Date(doc.updatedAt) >= new Date(existing.updatedAt)) {
      byId.set(doc.id, doc)
    }
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
  )
}

export async function getCloudSaveStatus() {
  if (!isSupabaseConfigured()) {
    return { statusLabel: 'Local Save Only', ok: false, configured: false, message: CLOUD_WARNING }
  }
  return checkSupabaseConnection()
}

export async function loadAllSavedDocuments() {
  const localDocs = loadSavedDocuments()

  if (!isSupabaseConfigured()) {
    return { docs: localDocs, source: 'local', cloudActive: false, error: null }
  }

  const { docs: cloudDocs, error } = await fetchCloudDocuments()
  if (error) {
    return { docs: localDocs, source: 'local', cloudActive: false, error }
  }

  const merged = mergeDocuments(cloudDocs, localDocs)
  persistSavedDocuments(merged)

  // Push any local-only docs to cloud
  const cloudIds = new Set(cloudDocs.map(d => d.id))
  const localOnly = localDocs.filter(d => !cloudIds.has(d.id))
  for (const doc of localOnly) {
    await upsertCloudDocument(doc)
  }

  return { docs: merged, source: 'cloud', cloudActive: true, error: null }
}

export async function saveDocumentUnified(doc) {
  const saved = saveDocument(doc)
  if (!saved) return { ok: false, error: 'Local save failed', cloudActive: false }

  if (!isSupabaseConfigured()) {
    return { ok: true, error: null, cloudActive: false, warning: CLOUD_WARNING }
  }

  const cloud = await upsertCloudDocument(saved)
  return {
    ok: true,
    error: cloud.error,
    cloudActive: cloud.ok,
    warning: cloud.error ? `Saved locally. Cloud sync failed: ${cloud.error}` : null,
  }
}

export async function deleteDocumentUnified(id) {
  const docs = loadSavedDocuments().filter(d => d.id !== id)
  const localOk = persistSavedDocuments(docs)
  if (!localOk) return { ok: false, error: 'Local delete failed' }

  if (isSupabaseConfigured()) {
    const cloud = await deleteCloudDocument(id)
    if (!cloud.ok) {
      return { ok: true, error: `Deleted locally. Cloud delete failed: ${cloud.error}` }
    }
  }
  return { ok: true, error: null }
}

export async function renameDocumentUnified(id, name) {
  const doc = getSavedDocument(id)
  if (!doc) return { ok: false, error: 'Document not found' }
  return saveDocumentUnified({ ...doc, name: name.trim(), updatedAt: new Date().toISOString() })
}

export async function duplicateDocumentUnified(id) {
  const source = getSavedDocument(id)
  if (!source) return { ok: false, error: 'Document not found', doc: null }
  const copy = createSavedDocument({
    name: `${source.name} (Copy)`,
    projectName: source.projectName,
    category: source.category,
    snapshot: JSON.parse(JSON.stringify(source.snapshot)),
  })
  const result = await saveDocumentUnified(copy)
  return { ...result, doc: copy }
}

export { createSavedDocument }
