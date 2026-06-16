/** AI Workflow action ids and helpers. */

import { mergeExtractIntoProjectData } from './projectIntelligence.js'
import { PRESENTATION_STYLES } from './qsWorkflow.js'

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

export function presentationStyleLabel(style) {
  if (style === PRESENTATION_STYLES.PREMIUM) return 'Premium Quotation'
  if (style === PRESENTATION_STYLES.DETAILED) return 'Detailed BOQ'
  return null
}

export const WORKFLOW_SESSION_KEY = 'constructiq-workflow-session'

export function saveWorkflowSession(session = {}) {
  try {
    localStorage.setItem(WORKFLOW_SESSION_KEY, JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      ...session,
    }))
    return true
  } catch {
    return false
  }
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
