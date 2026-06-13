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
  try {
    localStorage.setItem(SAVED_DOCS_STORAGE_KEY, JSON.stringify(docs))
    return true
  } catch (e) {
    console.error('[savedDocuments] persist failed', e)
    return false
  }
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
    snapshot: JSON.parse(JSON.stringify(source.snapshot)),
  })
  return saveDocument(copy) ? copy : null
}

export function getSavedDocument(id) {
  return loadSavedDocuments().find(d => d.id === id) || null
}
