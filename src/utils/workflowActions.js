import { safeLocalStorageSetItem, safeParseJson } from './safeSerialize.js'

/** AI Workflow action ids and helpers. */

import { mergeExtractIntoProjectData, projectDataToDocPayload } from './projectIntelligence.js'
import { applyPresentationStyle, PRESENTATION_STYLES } from './qsWorkflow.js'
import { normalizeDocumentSectionsForExport } from './documentSections.js'
import { parseAIResponse } from '../services/ai/responseParser.js'

export const WORKFLOW_ACTIONS = {
  IMPORT_BOQ: 'import-boq',
  REVIEW: 'review',
  EXTRACT_PRICES: 'extract-prices',
  SAVE_PRICES_PROFILE: 'save-prices-profile',
  CHOOSE_PRICING_SOURCE: 'choose-pricing-source',
  COMPARE_PROFILE_MARKET: 'compare-profile-market',
  PREMIUM_QUOTATION: 'premium-quotation',
  DETAILED_BOQ: 'detailed-boq',
  EXPORT_DOCGEN: 'export-docgen',
  SAVE_PROJECT: 'save-project',
  EXPORT_PDF: 'export-pdf',
  IMPORT_VARIATION: 'import-variation',
}

export function logWorkflowAction(action, result = {}) {
  const payload = { action, at: new Date().toISOString(), ...result }
  console.log('[WorkflowAction]', payload)
  return payload
}

const MISSING_MSG = 'Cannot perform this action yet. Required data is missing.'

/** Validate whether a workflow action can run — used to disable buttons and guard handlers. */
export function validateWorkflowAction(actionId, extract, context = {}) {
  const { extractedPricesCount = 0, livePricesCount = 0, workflowState = {} } = context
  const rows = ensureBoqRows(extract)
  const hasBoq = rows.length > 0 || hasBoqOrEstimateData(extract)
  const hasVariation = hasVariationData(extract)

  switch (actionId) {
    case WORKFLOW_ACTIONS.IMPORT_BOQ:
      if (!hasBoq) return { ok: false, reason: `${MISSING_MSG} BOQ or estimate lines.` }
      break
    case WORKFLOW_ACTIONS.REVIEW:
      if (!hasBoq) return { ok: false, reason: `${MISSING_MSG} BOQ or estimate to review.` }
      break
    case WORKFLOW_ACTIONS.EXTRACT_PRICES:
      if (!extract?.sourceText && !rows.length && !extract?.agreedPrices?.length && !hasBoqOrEstimateData(extract)) {
        return { ok: false, reason: `${MISSING_MSG} Chat prices or BOQ rates.` }
      }
      break
    case WORKFLOW_ACTIONS.SAVE_PRICES_PROFILE:
      if (!extractedPricesCount && !extract?.agreedPrices?.length && !rows.some(r => r.rate)) {
        return { ok: false, reason: `${MISSING_MSG} Extract prices from chat first.` }
      }
      break
    case WORKFLOW_ACTIONS.CHOOSE_PRICING_SOURCE:
      break
    case WORKFLOW_ACTIONS.COMPARE_PROFILE_MARKET:
      if (!hasBoq) return { ok: false, reason: `${MISSING_MSG} BOQ lines to compare.` }
      if (!livePricesCount) return { ok: false, reason: 'Live market prices are unavailable — try profile or manual pricing.' }
      break
    case WORKFLOW_ACTIONS.PREMIUM_QUOTATION:
    case WORKFLOW_ACTIONS.DETAILED_BOQ:
      if (!hasBoq) return { ok: false, reason: `${MISSING_MSG} BOQ or estimate.` }
      break
    case WORKFLOW_ACTIONS.EXPORT_DOCGEN:
      if (!hasBoq) return { ok: false, reason: `${MISSING_MSG} BOQ or estimate to export.` }
      if (!workflowState.presentationStyle) {
        return { ok: false, reason: 'Select Premium Quotation or Detailed BOQ style first.' }
      }
      break
    case WORKFLOW_ACTIONS.SAVE_PROJECT:
      if (!hasBoq && !extract?.projectTitle && !extract?.contractSum) {
        return { ok: false, reason: `${MISSING_MSG} Project or estimate details.` }
      }
      break
    case WORKFLOW_ACTIONS.EXPORT_PDF:
      if (!hasBoq && !extract?.contractSum) {
        return { ok: false, reason: `${MISSING_MSG} Estimate or BOQ to export.` }
      }
      break
    case WORKFLOW_ACTIONS.IMPORT_VARIATION:
      if (!hasVariation) return { ok: false, reason: `${MISSING_MSG} Variation schedule lines.` }
      break
    default:
      return { ok: false, reason: 'This action is not available.' }
  }
  return { ok: true }
}

export function hasBoqOrEstimateData(extract) {
  if (!extract) return false
  return Boolean(
    extract.boqRows?.length ||
    extract.hasBOQ ||
    extract.hasEstimate ||
    extract.contractSum,
  )
}

export function hasVariationData(extract) {
  return Boolean(extract?.variationItems?.length || extract?.hasVariation)
}

export function ensureBoqRows(extract) {
  if (!extract) return []
  if (Array.isArray(extract.boqRows) && extract.boqRows.length) return extract.boqRows
  if (Array.isArray(extract.boqItems) && extract.boqItems.length) return extract.boqItems
  return []
}

export function canOpenQsWorkflow(merged = {}, extract = {}) {
  return Boolean(
    asRowArray(merged.boqItems).length ||
    merged.assumptions?.length ||
    merged.exclusions?.length ||
    merged.provisional?.length ||
    extract?.contractSum ||
    merged.summaries?.commercial,
  )
}

function asRowArray(value) {
  return Array.isArray(value) ? value : []
}

/** Build safe project-intelligence payload for QS workflow modals. */
export function prepareWorkflowData(intelligenceData, extract, { presentationStyle, pricingConfig } = {}) {
  const base = intelligenceData || {}
  const baseItems = asRowArray(base.boqItems)
  const extractRows = ensureBoqRows(extract)
  const shouldMerge = extractRows.length || extract?.hasBOQ || extract?.hasEstimate
    || extract?.assumptions?.length || extract?.exclusions?.length

  const merged = shouldMerge
    ? mergeExtractIntoProjectData(base, {
      ...extract,
      boqRows: extractRows.length ? extractRows : asRowArray(extract.boqRows),
    }, { replaceBoq: extractRows.length > 0 && Boolean(extract?.hasBOQ) })
    : { ...base, boqItems: baseItems }

  const workflow = {
    ...(base.workflow || {}),
    ...(merged.workflow || {}),
    ...(presentationStyle ? { presentationStyle } : {}),
  }

  return {
    ...merged,
    boqItems: asRowArray(merged.boqItems),
    assumptions: Array.isArray(merged.assumptions) ? merged.assumptions : [],
    exclusions: Array.isArray(merged.exclusions) ? merged.exclusions : [],
    provisional: Array.isArray(merged.provisional) ? merged.provisional : [],
    workflow,
    presentationStyle: presentationStyle || workflow.presentationStyle || base.presentationStyle || null,
    pricingConfig: pricingConfig || base.pricingConfig || merged.pricingConfig || null,
    contractSum: extract?.contractSum || merged.pricing?.layers?.finalEstimate || null,
  }
}

/** Synchronous merge used before navigation or modal open. */
export function buildMergedFromExtract(intelligenceData, extract, { replaceBoq = false } = {}) {
  const rows = ensureBoqRows(extract)
  const payload = rows.length ? { ...extract, boqRows: rows } : extract
  return mergeExtractIntoProjectData(intelligenceData || {}, payload, {
    replaceBoq: replaceBoq && rows.length > 0,
  })
}

function pickNonEmpty(primary, fallback) {
  if (Array.isArray(primary) && primary.length) return primary
  if (Array.isArray(fallback) && fallback.length) return fallback
  return []
}

/** Re-parse chat message text and merge with stored extract (fixes stale or partial extracts). */
export function enrichExtractForExport(extract) {
  if (!extract) return null
  const sourceText = extract.sourceText || extract._sourceText || ''
  if (!sourceText.trim()) return { ...extract }

  let reparsed = {}
  try {
    reparsed = parseAIResponse(sourceText) || {}
  } catch {
    reparsed = {}
  }

  const boqRows = pickNonEmpty(ensureBoqRows(extract), ensureBoqRows(reparsed))
  return {
    ...reparsed,
    ...extract,
    sourceText,
    boqRows,
    materials: pickNonEmpty(extract.materials, reparsed.materials),
    labor: pickNonEmpty(extract.labor, reparsed.labor),
    assumptions: pickNonEmpty(extract.assumptions, reparsed.assumptions),
    exclusions: pickNonEmpty(extract.exclusions, reparsed.exclusions),
    provisional: pickNonEmpty(extract.provisional, reparsed.provisional),
    projectTitle: extract.projectTitle || reparsed.projectTitle,
    projectScope: extract.projectScope || reparsed.projectScope,
    projectDescription: extract.projectDescription || reparsed.projectScope,
    contractSum: extract.contractSum || reparsed.contractSum,
    takeoffNotes: extract.takeoffNotes || reparsed.takeoffNotes,
    hasBOQ: Boolean(extract.hasBOQ || reparsed.hasBOQ || boqRows.length > 2),
    hasEstimate: Boolean(extract.hasEstimate || reparsed.hasEstimate || extract.contractSum || reparsed.contractSum),
  }
}

/** Build PDF export payload from freshly merged intelligence + chat extract. */
export function buildPdfExportPayload(merged, extract, { style, docType = 'estimate' } = {}) {
  const sourceText = extract?.sourceText || ''
  const presentationStyle = style || merged?.workflow?.presentationStyle || PRESENTATION_STYLES.DETAILED
  const payload = projectDataToDocPayload(merged, { docType, source: 'ai-export' }) || {}

  const meta = {
    ...payload.meta,
    projectTitle: payload.meta?.projectTitle || extract?.projectTitle || 'Construction Estimate',
    projectDescription: payload.meta?.projectDescription || extract?.projectScope || extract?.projectDescription || '',
    projectLocation: payload.meta?.projectLocation || extract?.projectLocation || '',
    clientName: payload.meta?.clientName || extract?.clientName || '',
    notes: payload.meta?.notes || merged?.projectInfo?.notes || '',
  }

  const boqRows = pickNonEmpty(payload.boqRows, ensureBoqRows(extract))
  const materials = pickNonEmpty(payload.materials, extract?.materials)
  const labor = pickNonEmpty(payload.labor, extract?.labor)
  const assumptions = pickNonEmpty(payload.assumptions, extract?.assumptions)
  const exclusions = pickNonEmpty(payload.exclusions, extract?.exclusions)
  const provisional = pickNonEmpty(payload.provisional, extract?.provisional)
  const takeoffNotes = payload.drawingAnalysis?.takeoffNotes || extract?.takeoffNotes || ''
  const drawingAnalysis = { ...(payload.drawingAnalysis || {}), takeoffNotes }

  const styled = applyPresentationStyle({
    ...payload,
    meta,
    boqRows,
    materials,
    matCategories: payload.matCategories?.length ? payload.matCategories : (extract?.matCategories || []),
    labor,
    prelims: payload.prelims || [],
    assumptions,
    exclusions,
    provisional,
    drawingAnalysis,
    contractSum: payload.contractSum || extract?.contractSum || 0,
  }, presentationStyle)

  const documentSections = normalizeDocumentSectionsForExport(null, {
    meta: styled.meta,
    extras: {
      drawingAnalysis: styled.drawingAnalysis,
      assumptions: styled.assumptions,
      exclusions: styled.exclusions,
      provisional: styled.provisional,
      optionalItems: styled.optionalItems,
      clientSuppliedItems: styled.clientSuppliedItems,
    },
    sourceText,
    hasBoq: boqRows.length > 0,
  })

  if (import.meta.env.DEV) {
    console.log('[PDF Export]', {
      boqRows: boqRows.length,
      assumptions: assumptions.length,
      exclusions: exclusions.length,
      scope: Boolean(meta.projectDescription),
      sections: documentSections.filter(s => s.enabled).map(s => s.type),
      hasFallback: documentSections.some(s => s.title === 'AI Estimate Output'),
    })
  }

  return {
    type: presentationStyle === PRESENTATION_STYLES.PREMIUM ? 'quotation' : 'estimate',
    ...styled,
    documentSections,
    presentationStyle,
    sourceText,
  }
}

export function presentationStyleLabel(style) {
  if (style === PRESENTATION_STYLES.PREMIUM) return 'Premium Quotation'
  if (style === PRESENTATION_STYLES.DETAILED) return 'Detailed BOQ'
  return null
}

export const WORKFLOW_SESSION_KEY = 'constructiq-workflow-session'

export function saveWorkflowSession(session = {}) {
  const result = safeLocalStorageSetItem(WORKFLOW_SESSION_KEY, {
    version: 1,
    savedAt: new Date().toISOString(),
    ...session,
  })
  return result.ok
}

export function loadWorkflowSession() {
  try {
    const raw = localStorage.getItem(WORKFLOW_SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearWorkflowSession() {
  try {
    localStorage.removeItem(WORKFLOW_SESSION_KEY)
  } catch { /* ignore */ }
}
