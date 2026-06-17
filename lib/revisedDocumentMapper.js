/** Map variation orders ↔ revised_documents Supabase rows. */

export function variationOrderToRevisedDocument(vo, calculations = {}) {
  const calc = calculations.originalEstimateTotal != null ? calculations : {
    originalEstimateTotal: vo.originalEstimateTotal ?? 0,
    totalAdditions: vo.totalAdditions ?? 0,
    totalOmissions: vo.totalOmissions ?? 0,
    totalReductions: vo.totalReductions ?? 0,
    totalIncreases: vo.totalIncreases ?? 0,
    netVariation: vo.netVariation ?? 0,
    revisedTotal: vo.revisedTotal ?? 0,
  }

  return {
    id: `rd-${vo.id}`,
    originalDocumentId: vo.originalEstimateId || '',
    projectId: vo.projectId || '',
    clientName: vo.clientName || '',
    projectTitle: vo.projectName || '',
    revisionNumber: vo.revisionNumber || 1,
    variationNumber: vo.variationNumber || '',
    originalTotal: calc.originalEstimateTotal ?? 0,
    totalAdditions: calc.totalAdditions ?? 0,
    totalOmissions: calc.totalOmissions ?? 0,
    totalReductions: calc.totalReductions ?? 0,
    totalIncreases: calc.totalIncreases ?? 0,
    netVariation: calc.netVariation ?? 0,
    revisedTotal: calc.revisedTotal ?? 0,
    status: vo.status || 'draft',
    documentData: {
      variationOrderId: vo.id,
      originalEstimateRef: vo.originalEstimateRef || '',
      projectLocation: vo.projectLocation || '',
      reasonForVariation: vo.reasonForVariation || '',
      date: vo.date || '',
      sourceType: vo.sourceType || '',
      paymentNote: vo.paymentNote || '',
      originalBoqSnapshot: vo.originalBoqSnapshot || [],
      auditTrail: vo.auditTrail || [],
    },
    variationItems: vo.items || [],
    notes: vo.reasonForVariation || '',
    createdAt: vo.createdAt || new Date().toISOString(),
    updatedAt: vo.updatedAt || new Date().toISOString(),
  }
}

export function revisedDocumentToRow(doc) {
  const now = new Date().toISOString()
  return {
    id: doc.id,
    original_document_id: doc.originalDocumentId || '',
    project_id: doc.projectId || '',
    client_name: doc.clientName || '',
    project_title: doc.projectTitle || '',
    revision_number: Number(doc.revisionNumber) || 1,
    variation_number: doc.variationNumber || '',
    original_total: Number(doc.originalTotal) || 0,
    total_additions: Number(doc.totalAdditions) || 0,
    total_omissions: Number(doc.totalOmissions) || 0,
    total_reductions: Number(doc.totalReductions) || 0,
    total_increases: Number(doc.totalIncreases) || 0,
    net_variation: Number(doc.netVariation) || 0,
    revised_total: Number(doc.revisedTotal) || 0,
    status: doc.status || 'draft',
    document_data: doc.documentData || {},
    variation_items: doc.variationItems || [],
    notes: doc.notes || '',
    created_at: doc.createdAt || now,
    updated_at: doc.updatedAt || now,
  }
}

export function rowToRevisedDocument(row) {
  if (!row?.id) return null
  const data = row.document_data || {}
  return {
    id: row.id,
    originalDocumentId: row.original_document_id || '',
    projectId: row.project_id || '',
    clientName: row.client_name || '',
    projectTitle: row.project_title || '',
    revisionNumber: Number(row.revision_number) || 1,
    variationNumber: row.variation_number || '',
    originalTotal: Number(row.original_total) || 0,
    totalAdditions: Number(row.total_additions) || 0,
    totalOmissions: Number(row.total_omissions) || 0,
    totalReductions: Number(row.total_reductions) || 0,
    totalIncreases: Number(row.total_increases) || 0,
    netVariation: Number(row.net_variation) || 0,
    revisedTotal: Number(row.revised_total) || 0,
    status: row.status || 'draft',
    documentData: data,
    variationItems: row.variation_items || [],
    notes: row.notes || '',
    variationOrderId: data.variationOrderId || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
