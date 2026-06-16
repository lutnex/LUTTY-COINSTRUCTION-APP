/** Shared mapping between app variation order objects and Supabase rows. */

export function rowToVariationOrder(row) {
  if (!row) return null
  const snapshot = row.snapshot || {}
  return {
    id: row.id,
    variationNumber: row.variation_number || snapshot.variationNumber || '',
    projectId: row.project_id || snapshot.projectId || '',
    projectName: row.project_name || snapshot.projectName || '',
    projectLocation: snapshot.projectLocation || '',
    clientName: row.client_name || snapshot.clientName || '',
    clientContact: snapshot.clientContact || '',
    clientEmail: snapshot.clientEmail || '',
    originalEstimateId: row.original_estimate_id || snapshot.originalEstimateId || '',
    originalEstimateRef: row.original_estimate_ref || snapshot.originalEstimateRef || '',
    originalEstimateTotal: Number(row.original_estimate_total ?? snapshot.originalEstimateTotal) || 0,
    revisedTotal: Number(row.revised_total ?? snapshot.revisedTotal) || 0,
    status: row.status || snapshot.status || 'draft',
    reasonForVariation: snapshot.reasonForVariation || '',
    date: row.vo_date || snapshot.date || '',
    sourceType: snapshot.sourceType || 'manual',
    paymentNote: snapshot.paymentNote || '',
    items: snapshot.items || [],
    originalBoqSnapshot: snapshot.originalBoqSnapshot || [],
    auditTrail: snapshot.auditTrail || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...snapshot,
  }
}

export function variationOrderToRow(vo) {
  const snapshot = {
    variationNumber: vo.variationNumber,
    projectId: vo.projectId,
    projectName: vo.projectName,
    projectLocation: vo.projectLocation,
    clientName: vo.clientName,
    clientContact: vo.clientContact,
    clientEmail: vo.clientEmail,
    originalEstimateId: vo.originalEstimateId,
    originalEstimateRef: vo.originalEstimateRef,
    originalEstimateTotal: vo.originalEstimateTotal,
    revisedTotal: vo.revisedTotal,
    status: vo.status,
    reasonForVariation: vo.reasonForVariation,
    date: vo.date,
    sourceType: vo.sourceType,
    paymentNote: vo.paymentNote,
    items: vo.items,
    originalBoqSnapshot: vo.originalBoqSnapshot,
    auditTrail: vo.auditTrail,
    totalAdditions: vo.totalAdditions,
    totalOmissions: vo.totalOmissions,
    totalReductions: vo.totalReductions,
    totalIncreases: vo.totalIncreases,
    netVariation: vo.netVariation,
  }

  return {
    id: vo.id,
    variation_number: vo.variationNumber || '',
    project_id: vo.projectId || '',
    project_name: vo.projectName || '',
    client_name: vo.clientName || '',
    original_estimate_id: vo.originalEstimateId || '',
    original_estimate_ref: vo.originalEstimateRef || '',
    original_estimate_total: vo.originalEstimateTotal || 0,
    revised_total: vo.revisedTotal || 0,
    status: vo.status || 'draft',
    vo_date: vo.date || null,
    snapshot,
    created_at: vo.createdAt,
    updated_at: vo.updatedAt,
  }
}
