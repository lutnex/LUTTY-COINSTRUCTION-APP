/** Variation Order types, constants, and factory helpers. */

export const VO_STORAGE_KEY = 'constructiq-variation-orders'

export const CHANGE_TYPES = {
  ADDITION: 'addition',
  OMISSION: 'omission',
  REDUCTION: 'reduction',
  INCREASE: 'increase',
  SUBSTITUTION: 'substitution',
  RATE_ADJUSTMENT: 'rate_adjustment',
  QUANTITY_ADJUSTMENT: 'quantity_adjustment',
  PROVISIONAL: 'provisional',
  CLIENT_SUPPLIED: 'client_supplied',
  OPTIONAL: 'optional',
}

export const CHANGE_TYPE_LABELS = {
  [CHANGE_TYPES.ADDITION]: 'Addition',
  [CHANGE_TYPES.OMISSION]: 'Omission / Removal',
  [CHANGE_TYPES.REDUCTION]: 'Reduction',
  [CHANGE_TYPES.INCREASE]: 'Increase',
  [CHANGE_TYPES.SUBSTITUTION]: 'Substitution',
  [CHANGE_TYPES.RATE_ADJUSTMENT]: 'Rate Adjustment',
  [CHANGE_TYPES.QUANTITY_ADJUSTMENT]: 'Quantity Adjustment',
  [CHANGE_TYPES.PROVISIONAL]: 'Provisional Item',
  [CHANGE_TYPES.CLIENT_SUPPLIED]: 'Client-Supplied Change',
  [CHANGE_TYPES.OPTIONAL]: 'Optional Item',
}

export const ITEM_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  OPTIONAL: 'optional',
  TBC: 'tbc',
}

export const ITEM_STATUS_LABELS = {
  [ITEM_STATUSES.PENDING]: 'Pending',
  [ITEM_STATUSES.APPROVED]: 'Approved',
  [ITEM_STATUSES.REJECTED]: 'Rejected',
  [ITEM_STATUSES.OPTIONAL]: 'Optional',
  [ITEM_STATUSES.TBC]: 'To Be Confirmed',
}

export const VO_STATUSES = {
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ISSUED: 'issued',
}

export const VO_STATUS_LABELS = {
  [VO_STATUSES.DRAFT]: 'Draft',
  [VO_STATUSES.PENDING]: 'Pending Approval',
  [VO_STATUSES.APPROVED]: 'Approved',
  [VO_STATUSES.REJECTED]: 'Rejected',
  [VO_STATUSES.ISSUED]: 'Issued',
}

export const VO_SOURCE_TYPES = {
  ESTIMATE: 'estimate',
  UPLOAD: 'upload',
  MANUAL: 'manual',
}

export const VO_EXPORT_TYPES = {
  CLIENT_QUOTATION: 'client_quotation',
  INTERNAL_SCHEDULE: 'internal_schedule',
  REVISED_ESTIMATE: 'revised_estimate',
  ADDENDUM: 'addendum',
}

/** File format exports for Variation Order page */
export const VO_FILE_FORMATS = {
  PDF: 'pdf',
  DOCX: 'docx',
  CSV: 'csv',
  HTML: 'html',
}

export const VO_FILE_FORMAT_LABELS = {
  [VO_FILE_FORMATS.PDF]: 'PDF — Client-facing variation order',
  [VO_FILE_FORMATS.DOCX]: 'DOCX — Editable formal variation document',
  [VO_FILE_FORMATS.CSV]: 'CSV — Variation schedule table',
  [VO_FILE_FORMATS.HTML]: 'HTML — Print-ready web document',
}

export const VO_EXPORT_LABELS = {
  [VO_EXPORT_TYPES.CLIENT_QUOTATION]: 'Client-facing Variation Quotation',
  [VO_EXPORT_TYPES.INTERNAL_SCHEDULE]: 'Internal Detailed Variation Schedule',
  [VO_EXPORT_TYPES.REVISED_ESTIMATE]: 'Revised Full Estimate',
  [VO_EXPORT_TYPES.ADDENDUM]: 'Addendum to Original Estimate',
}

export const CHANGE_TYPE_OPTIONS = Object.entries(CHANGE_TYPE_LABELS).map(([value, label]) => ({ value, label }))
export const ITEM_STATUS_OPTIONS = Object.entries(ITEM_STATUS_LABELS).map(([value, label]) => ({ value, label }))

export function formatVariationNumber(seq) {
  return `VO-${String(seq).padStart(3, '0')}`
}

export function nextVariationNumber(existingOrders = [], projectId = null) {
  const relevant = projectId
    ? existingOrders.filter(vo => vo.projectId === projectId)
    : existingOrders
  const max = relevant.reduce((m, vo) => {
    const match = /^VO-(\d+)$/i.exec(vo.variationNumber || '')
    return match ? Math.max(m, parseInt(match[1], 10)) : m
  }, 0)
  return formatVariationNumber(max + 1)
}

function parseNum(v) {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function calcLineAmount(qty, rate) {
  return Math.round(parseNum(qty) * parseNum(rate) * 100) / 100
}

export function normalizeVariationItem(row = {}, index = 0) {
  const originalQty = String(row.originalQty ?? row.qty ?? '')
  const revisedQty = String(row.revisedQty ?? '')
  const originalRate = String(row.originalRate ?? row.rate ?? '')
  const revisedRate = String(row.revisedRate ?? row.rate ?? '')
  const originalAmount = row.originalAmount != null && row.originalAmount !== ''
    ? parseNum(row.originalAmount)
    : calcLineAmount(originalQty, originalRate)
  const revisedAmount = row.revisedAmount != null && row.revisedAmount !== ''
    ? parseNum(row.revisedAmount)
    : calcLineAmount(revisedQty, revisedRate)
  const difference = row.difference != null && row.difference !== ''
    ? parseNum(row.difference)
    : Math.round((revisedAmount - originalAmount) * 100) / 100

  return {
    id: row.id ?? `vi-${Date.now()}-${index}`,
    itemNo: row.itemNo ?? index + 1,
    originalItemRef: row.originalItemRef || row.itemRef || '',
    description: row.description || row.desc || '',
    changeType: row.changeType || CHANGE_TYPES.ADDITION,
    originalQty,
    revisedQty,
    unit: row.unit || 'nr',
    originalRate,
    revisedRate,
    originalAmount,
    revisedAmount,
    difference,
    reason: row.reason || '',
    status: row.status || (row.tbc ? ITEM_STATUSES.TBC : ITEM_STATUSES.PENDING),
    notes: row.notes || '',
    tbc: Boolean(row.tbc || row.status === ITEM_STATUSES.TBC),
  }
}

export function createEmptyVariationItem(itemNo = 1) {
  return normalizeVariationItem({
    itemNo,
    description: '',
    changeType: CHANGE_TYPES.ADDITION,
    originalQty: '',
    revisedQty: '',
    unit: 'nr',
    originalRate: '',
    revisedRate: '',
    reason: '',
    status: ITEM_STATUSES.PENDING,
  })
}

export function boqRowToVariationItem(row, changeType = CHANGE_TYPES.ADDITION) {
  return normalizeVariationItem({
    originalItemRef: row.itemRef || '',
    description: row.desc || '',
    changeType,
    originalQty: row.qty || '',
    revisedQty: row.qty || '',
    unit: row.unit || 'nr',
    originalRate: row.rate || '',
    revisedRate: row.rate || '',
    originalAmount: row.amount || '',
    revisedAmount: row.amount || '',
    reason: '',
    status: ITEM_STATUSES.PENDING,
    source: 'import',
  })
}

export function createVariationOrder(partial = {}, existingOrders = []) {
  const now = new Date().toISOString()
  const projectId = partial.projectId || ''
  const items = (partial.items || []).map(normalizeVariationItem)
  const originalEstimateTotal = parseNum(partial.originalEstimateTotal)

  return {
    id: partial.id || `vo-${Date.now()}`,
    variationNumber: partial.variationNumber || nextVariationNumber(existingOrders, projectId),
    projectId,
    projectName: partial.projectName || '',
    projectLocation: partial.projectLocation || '',
    clientName: partial.clientName || '',
    clientContact: partial.clientContact || '',
    clientEmail: partial.clientEmail || '',
    originalEstimateId: partial.originalEstimateId || '',
    originalEstimateRef: partial.originalEstimateRef || '',
    originalEstimateTotal,
    revisedTotal: partial.revisedTotal ?? originalEstimateTotal,
    status: partial.status || VO_STATUSES.DRAFT,
    reasonForVariation: partial.reasonForVariation || '',
    date: partial.date || now.slice(0, 10),
    sourceType: partial.sourceType || VO_SOURCE_TYPES.MANUAL,
    paymentNote: partial.paymentNote || 'This variation is subject to client written approval before commencement of additional works.',
    items,
    originalBoqSnapshot: partial.originalBoqSnapshot || [],
    auditTrail: partial.auditTrail || [{
      at: now,
      action: 'created',
      detail: `Variation ${partial.variationNumber || 'order'} created`,
      user: 'system',
    }],
    createdAt: partial.createdAt || now,
    updatedAt: partial.updatedAt || now,
  }
}

export function appendAuditEntry(vo, action, detail, user = 'user') {
  const entry = { at: new Date().toISOString(), action, detail, user }
  return { ...vo, auditTrail: [...(vo.auditTrail || []), entry], updatedAt: entry.at }
}
