import { safeLocalStorageSetItem, safeParseJson, safeJsonClone } from './safeSerialize.js'

export const SAVED_DOCS_STORAGE_KEY = 'constructiq-saved-documents'

export const DOCUMENT_CATEGORIES = [
  { id: 'estimate', label: 'Estimate' },
  { id: 'boq', label: 'BOQ' },
  { id: 'quotation', label: 'Quotation' },
  { id: 'invoice', label: 'Invoice' },
  { id: 'other', label: 'Other' },
]

export function loadSavedDocuments() {
  try {
    const raw = localStorage.getItem(SAVED_DOCS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function persistSavedDocuments(docs) {
  const result = safeLocalStorageSetItem(SAVED_DOCS_STORAGE_KEY, docs)
  if (!result.ok) {
    console.error('[savedDocuments] persist failed', result.error)
    return false
  }
  return true
}

export function createSavedDocument({ name, projectName, category, snapshot }) {
  const now = new Date().toISOString()
  return {
    id: `doc-${Date.now()}`,
    name: name.trim(),
    projectName: projectName.trim(),
    category,
    createdAt: now,
    updatedAt: now,
    contractSum: snapshot.contractSum || 0,
    previewHtml: snapshot.previewHtml || null,
    snapshot,
  }
}

export function saveDocument(doc) {
  const docs = loadSavedDocuments()
  const idx = docs.findIndex(d => d.id === doc.id)
  const next = idx >= 0
    ? docs.map((d, i) => (i === idx ? { ...doc, updatedAt: new Date().toISOString() } : d))
    : [doc, ...docs]
  return persistSavedDocuments(next) ? doc : null
}

export function deleteSavedDocument(id) {
  const docs = loadSavedDocuments()
  const next = docs.filter(d => d.id !== id)
  if (next.length === docs.length) return false
  return persistSavedDocuments(next)
}

export function renameSavedDocument(id, name) {
  const docs = loadSavedDocuments()
  const next = docs.map(d => d.id === id ? { ...d, name: name.trim(), updatedAt: new Date().toISOString() } : d)
  return persistSavedDocuments(next)
}

export function duplicateSavedDocument(id) {
  const docs = loadSavedDocuments()
  const source = docs.find(d => d.id === id)
  if (!source) return null
  const copy = createSavedDocument({
    name: `${source.name} (Copy)`,
    projectName: source.projectName,
    category: source.category,
    snapshot: safeJsonClone(source.snapshot),
  })
  return saveDocument(copy) ? copy : null
}

export function getSavedDocument(id) {
  return loadSavedDocuments().find(d => d.id === id) || null
}

export function getRevisionsForDocument(parentDocumentId) {
  if (!parentDocumentId) return []
  return loadSavedDocuments()
    .filter(d => d.parentDocumentId === parentDocumentId)
    .sort((a, b) => (a.revisionNumber || 0) - (b.revisionNumber || 0))
}

export function nextRevisionForDocument(parentDocumentId) {
  const revs = getRevisionsForDocument(parentDocumentId)
  const max = revs.reduce((m, r) => Math.max(m, parseInt(r.revisionNumber, 10) || 0), 0)
  return max + 1
}

/** Save a revised document — never overwrites the original issued estimate. */
export function createRevisedDocument({
  parentDocument,
  revisionNumber,
  variationOrderId = null,
  variationNumber = '',
  snapshot,
  name,
}) {
  const now = new Date().toISOString()
  const parent = parentDocument || {}
  const rev = revisionNumber || 1
  const revisedTotal = snapshot?.revision?.calculations?.revisedTotal
    ?? snapshot?.variationSummary?.revisedTotal
    ?? snapshot?.contractSum
    ?? 0

  return {
    id: `doc-${Date.now()}-r${rev}`,
    name: (name || `${parent.name || 'Document'} — Revision ${rev}`).trim(),
    projectName: parent.projectName || snapshot?.meta?.projectTitle || '',
    category: parent.category || snapshot?.docType || 'estimate',
    createdAt: now,
    updatedAt: now,
    contractSum: revisedTotal,
    previewHtml: snapshot?.previewHtml || null,
    parentDocumentId: parent.id || snapshot?.revision?.originalDocumentId || null,
    revisionNumber: rev,
    variationOrderId,
    variationNumber,
    isRevision: true,
    originalDocumentId: parent.id || snapshot?.revision?.originalDocumentId || null,
    originalTotal: snapshot?.revision?.originalTotal ?? parent.contractSum ?? 0,
    snapshot: {
      ...snapshot,
      version: 2,
      revision: snapshot?.revision || {
        revisionNumber: rev,
        variationOrderId,
        variationNumber,
        originalDocumentId: parent.id || null,
        originalTotal: parent.contractSum ?? 0,
        calculations: snapshot?.variationSummary || null,
        items: snapshot?.variations || [],
        status: 'saved',
      },
    },
  }
}
