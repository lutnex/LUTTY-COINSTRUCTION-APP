/** Shared mapping between app document objects and Supabase rows. */

export function rowToDocument(row) {
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

export function documentToRow(doc) {
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
