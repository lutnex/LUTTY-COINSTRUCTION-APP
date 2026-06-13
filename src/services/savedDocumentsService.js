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
  insertCloudDocument,
  deleteCloudDocument,
} from './supabase/savedDocumentsCloud.js'
import { checkSupabaseConnection } from './supabase/client.js'
import { formatSupabaseError } from '../../lib/supabaseServer.js'

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
  return checkSupabaseConnection()
}

/** Docs that need uploading: missing in cloud or local copy is newer. */
export function getDocumentsNeedingCloudSync(localDocs, cloudDocs) {
  const cloudById = new Map(cloudDocs.map(d => [d.id, d]))
  return localDocs.filter(local => {
    const cloud = cloudById.get(local.id)
    if (!cloud) return true
    return new Date(local.updatedAt) > new Date(cloud.updatedAt)
  })
}

export async function migrateLocalDocumentsToCloud() {
  const health = await checkSupabaseConnection()
  if (!health.ok) {
    return {
      ok: false,
      migrated: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
      errors: [health.message || 'Supabase is not connected'],
    }
  }

  const localDocs = loadSavedDocuments()
  const { docs: cloudDocs, error } = await fetchCloudDocuments()
  if (error) {
    return {
      ok: false,
      migrated: 0,
      failed: 0,
      skipped: 0,
      pending: localDocs.length,
      errors: [error],
    }
  }

  const toMigrate = getDocumentsNeedingCloudSync(localDocs, cloudDocs)
  if (!toMigrate.length) {
    return {
      ok: true,
      migrated: 0,
      failed: 0,
      skipped: localDocs.length,
      pending: 0,
      errors: [],
    }
  }

  let migrated = 0
  let failed = 0
  const errors = []

  for (const doc of toMigrate) {
    const result = await upsertCloudDocument(doc)
    if (result.ok) {
      migrated++
    } else {
      failed++
      errors.push(`${doc.name}: ${result.error}`)
    }
  }

  return {
    ok: failed === 0,
    migrated,
    failed,
    skipped: localDocs.length - toMigrate.length,
    pending: toMigrate.length,
    errors,
  }
}

export function parseBackupDocuments(raw) {
  let parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (typeof parsed === 'string') {
    parsed = JSON.parse(parsed)
  }
  const docs = Array.isArray(parsed)
    ? parsed
    : (Array.isArray(parsed?.documents) ? parsed.documents : null)
  if (!docs) {
    throw new Error('Invalid backup format. Expected a JSON array of saved documents.')
  }
  return docs.filter(doc => doc?.id && doc?.name)
}

function mergeImportedDocsIntoLocal(docs) {
  const localDocs = loadSavedDocuments()
  const localIds = new Set(localDocs.map(d => d.id))
  const mergedLocal = [...localDocs]
  for (const doc of docs) {
    if (!localIds.has(doc.id)) {
      mergedLocal.unshift(doc)
      localIds.add(doc.id)
    }
  }
  persistSavedDocuments(mergedLocal)
}

async function importBackupDocumentsDirect(docs) {
  const health = await checkSupabaseConnection()
  if (!health.ok) {
    return {
      ok: false,
      imported: 0,
      skipped: 0,
      failed: 0,
      total: docs.length,
      errors: [health.message || 'Supabase is not connected'],
    }
  }

  const { docs: cloudDocs, error } = await fetchCloudDocuments()
  if (error) {
    return {
      ok: false,
      imported: 0,
      skipped: 0,
      failed: 0,
      total: docs.length,
      errors: [formatSupabaseError({ message: error })],
    }
  }

  const cloudIds = new Set(cloudDocs.map(d => d.id))
  const toInsert = docs.filter(doc => !cloudIds.has(doc.id))
  let imported = 0
  let skipped = docs.length - toInsert.length
  let failed = 0
  const errors = []

  for (const doc of toInsert) {
    const result = await insertCloudDocument(doc)
    if (result.ok && !result.skipped) {
      imported++
    } else if (result.ok && result.skipped) {
      skipped++
    } else {
      failed++
      errors.push(`${doc.name}: ${formatSupabaseError({ message: result.error })}`)
    }
  }

  mergeImportedDocsIntoLocal(docs)

  return {
    ok: failed === 0,
    imported,
    skipped,
    failed,
    total: docs.length,
    errors,
  }
}

/** Import backup JSON into Supabase without overwriting existing cloud documents. */
export async function importBackupDocuments(docs) {
  try {
    const response = await fetch('/api/documents/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documents: docs }),
    })

    const result = await response.json().catch(() => null)
    if (response.ok && result) {
      mergeImportedDocsIntoLocal(docs)
      return {
        ok: Boolean(result.ok),
        imported: result.imported ?? 0,
        skipped: result.skipped ?? 0,
        failed: result.failed ?? 0,
        total: result.total ?? docs.length,
        errors: result.errors ?? [],
      }
    }

    if (response.status === 404) {
      return importBackupDocumentsDirect(docs)
    }

    const serverErrors = result?.errors?.length
      ? result.errors
      : [result?.error || `Import API failed (${response.status})`]

    return {
      ok: false,
      imported: result?.imported ?? 0,
      skipped: result?.skipped ?? 0,
      failed: result?.failed ?? docs.length,
      total: docs.length,
      errors: serverErrors,
    }
  } catch {
    return importBackupDocumentsDirect(docs)
  }
}

export function exportLocalDocumentsForMigration() {
  const docs = loadSavedDocuments()
  const blob = new Blob([JSON.stringify(docs, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `constructiq-documents-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
  return docs.length
}

export async function loadAllSavedDocuments() {
  const localDocs = loadSavedDocuments()
  const health = await checkSupabaseConnection()

  if (!health.ok) {
    return {
      docs: localDocs,
      source: 'local',
      cloudActive: false,
      error: health.configured ? health.message : null,
      migration: null,
    }
  }

  const { docs: cloudDocs, error } = await fetchCloudDocuments()
  if (error) {
    return { docs: localDocs, source: 'local', cloudActive: false, error, migration: null }
  }

  const migration = await migrateLocalDocumentsToCloud()
  const { docs: refreshedCloudDocs, error: refreshError } = await fetchCloudDocuments()
  const cloudDocsFinal = refreshError ? cloudDocs : refreshedCloudDocs

  const merged = mergeDocuments(cloudDocsFinal, localDocs)
  persistSavedDocuments(merged)

  return {
    docs: merged,
    source: 'cloud',
    cloudActive: true,
    error: migration.failed ? migration.errors.join('; ') : null,
    migration,
  }
}

export async function saveDocumentUnified(doc) {
  const saved = saveDocument(doc)
  if (!saved) return { ok: false, error: 'Local save failed', cloudActive: false }

  const health = await checkSupabaseConnection()
  if (!health.ok) {
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

  const health = await checkSupabaseConnection()
  if (health.ok) {
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
