import { safeLocalStorageSetItem, safeParseJson, safeJsonClone } from './safeSerialize.js'
import { today } from './formatters.js'
import { normalizeBoqRow } from './boqItemFactory.js'
import { computePricing } from '../services/pricing/pricingEngine.js'
import { projectDataToDocPayload } from './projectIntelligence.js'
import {
  normalizePaymentTerms,
  resolveInitialPaymentTerms,
} from './paymentTerms.js'
import {
  normalizeDocumentSections,
} from './documentSections.js'
import {
  boqRowsToCategorizedMaterials,
  normalizeMaterialState,
} from './materialCategories.js'

export const DOCGEN_STORAGE_KEY = 'constructiq-docgen-draft'

const DEFAULT_META = {
  quoteNum: '',
  date: today(),
  validDays: '30',
  clientName: '',
  clientContact: '',
  clientEmail: '',
  projectLocation: '',
  projectTitle: '',
  projectDescription: '',
  notes: '',
}

export function boqRowsToMaterials(rows = []) {
  return boqRowsToCategorizedMaterials(rows).materials
}

/**
 * Package BOQ for DocGen — uses pricing engine (no double markup).
 */
export function serializeBOQ(rows = [], { project, totals, notes, intelligence } = {}) {
  if (intelligence) {
    return projectDataToDocPayload(intelligence, { docType: 'boq', source: intelligence.metadata?.source || 'intelligence' })
  }

  const pm = project?.meta ?? {}
  const boqRows = rows.map((r, i) => normalizeBoqRow(r, i))
  const { categories: matCategories, materials } = boqRowsToCategorizedMaterials(boqRows)

  const pricing = computePricing({ boqRows, materials, financialAdjustments: totals?.financialAdjustments })

  const { summary, prelimsForDoc, layers } = pricing

  const meta = {
    ...DEFAULT_META,
    quoteNum: pm.quoteNum || `DLC-BOQ-${today().replace(/-/g, '')}`,
    date: pm.date || today(),
    validDays: pm.validDays || '30',
    clientName: pm.clientName || '',
    clientContact: pm.clientContact || '',
    clientEmail: pm.clientEmail || '',
    projectLocation: pm.projectLocation || '',
    projectTitle: pm.projectTitle || project?.name || 'Construction BOQ',
    projectDescription: pm.projectDescription || `Bill of Quantities — ${boqRows.length} items`,
    notes: notes || pm.notes || '',
    paymentTerms: 'paymentTerms' in pm
      ? normalizePaymentTerms(pm.paymentTerms)
      : resolveInitialPaymentTerms(null),
  }

  return {
    version: 1,
    source: 'boq-builder',
    transferredAt: new Date().toISOString(),
    docType: 'boq',
    projectName: project?.name || meta.projectTitle,
    meta,
    boqRows,
    matCategories,
    materials,
    labor: [],
    prelims: prelimsForDoc,
    assumptions: [],
    exclusions: [],
    drawingAnalysis: {},
    risks: [],
    collections: [],
    pricing,
    totals: summary,
    contractSum: layers.finalEstimate,
  }
}

export function hydrateBOQDocument(docGen, payload) {
  if (!payload || !docGen) return false

  const hasRows = (payload.boqRows?.length ?? 0) > 0 || (payload.materials?.length ?? 0) > 0
  if (!hasRows && !payload.meta?.projectTitle) return false

  docGen.setDocType(payload.docType || 'boq')

  const payloadMeta = payload.meta || {}
  const mergedMeta = { ...DEFAULT_META, ...payloadMeta }
  if ('paymentTerms' in payloadMeta) {
    mergedMeta.paymentTerms = normalizePaymentTerms(payloadMeta.paymentTerms)
  } else {
    mergedMeta.paymentTerms = resolveInitialPaymentTerms(null)
  }
  docGen.setMetaRaw(m => ({ ...m, ...mergedMeta }))

  if (payload.boqRows?.length) docGen.setBoqRows(payload.boqRows.map((r, i) => normalizeBoqRow(r, i)))
  if (payload.materials?.length || payload.matCategories?.length) {
    if (docGen.setMaterialState) {
      docGen.setMaterialState(payload.matCategories || [], payload.materials || [])
    } else {
      const normalized = normalizeMaterialState(payload.materials || [], payload.matCategories || [])
      docGen.setMats?.(normalized.materials)
      docGen.setMatCategories?.(normalized.categories)
    }
  }
  if (payload.labor?.length) docGen.setLabor(payload.labor)
  if (payload.prelims?.length) docGen.setPrelims(payload.prelims)
  if (payload.financialAdjustments && docGen.setFinancialAdjustments) {
    docGen.setFinancialAdjustments(payload.financialAdjustments)
  }
  if (payload.documentSections?.length && docGen.setDocumentSections) {
    docGen.setDocumentSections(normalizeDocumentSections(payload.documentSections, { meta: payload.meta, extras: payload }))
  } else if (docGen.setDocumentSections) {
    docGen.setDocumentSections(normalizeDocumentSections(null, { meta: payload.meta, extras: payload }))
  }

  docGen.setIntelligenceExtras?.({
    assumptions: payload.assumptions || [],
    exclusions: payload.exclusions || [],
    provisional: payload.provisional || [],
    optionalItems: payload.optionalItems || [],
    clientSuppliedItems: payload.clientSuppliedItems || [],
    drawingAnalysis: payload.drawingAnalysis || {},
    risks: payload.risks || [],
    pricing: payload.pricing || null,
    workflow: payload.workflow || null,
    presentationStyle: payload.presentationStyle || null,
    boqCategorySummaries: payload.boqCategorySummaries || null,
  })

  return true
}

export function saveDocGenDraft(payload) {
  const result = safeLocalStorageSetItem(DOCGEN_STORAGE_KEY, payload)
  if (!result.ok) console.error('[boqWorkflow] save failed', result.error)
  return result.ok
}

export function loadDocGenDraft() {
  try {
    const raw = localStorage.getItem(DOCGEN_STORAGE_KEY)
    return safeParseJson(raw, null)
  } catch (e) {
    console.error('[boqWorkflow] load failed', e)
    return null
  }
}

export function clearDocGenDraft() {
  try {
    localStorage.removeItem(DOCGEN_STORAGE_KEY)
  } catch { /* ignore */ }
}

export function persistDocGenState(docGen) {
  const payload = {
    version: 1,
    source: 'docgen',
    transferredAt: new Date().toISOString(),
    docType: docGen.docType,
    meta: docGen.meta,
    boqRows: docGen.boqRows,
    materials: docGen.mats,
    matCategories: docGen.matCategories,
    labor: docGen.labor,
    prelims: docGen.prelims,
    contractSum: docGen.contractSum,
    financialAdjustments: docGen.financialAdjustments,
    assumptions: docGen.extras?.assumptions,
    exclusions: docGen.extras?.exclusions,
    provisional: docGen.extras?.provisional,
    optionalItems: docGen.extras?.optionalItems,
    clientSuppliedItems: docGen.extras?.clientSuppliedItems,
    drawingAnalysis: docGen.extras?.drawingAnalysis,
    risks: docGen.extras?.risks,
    pricing: docGen.extras?.pricing,
    workflow: docGen.extras?.workflow,
    presentationStyle: docGen.extras?.presentationStyle,
    boqCategorySummaries: docGen.extras?.boqCategorySummaries,
    documentSections: docGen.documentSections,
    preview: docGen.preview,
  }
  saveDocGenDraft(payload)
}
