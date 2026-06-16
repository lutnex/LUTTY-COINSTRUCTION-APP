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

/** Build safe project-intelligence payload for QS workflow modals. */
export function prepareWorkflowData(intelligenceData, extract, { presentationStyle, pricingConfig } = {}) {
  const base = intelligenceData || {}
  const merged = extract?.boqRows?.length || extract?.hasBOQ || extract?.hasEstimate
    ? mergeExtractIntoProjectData(base, extract)
    : {
      ...base,
      boqItems: Array.isArray(base.boqItems) ? base.boqItems : [],
    }

  const workflow = {
    ...(base.workflow || {}),
    ...(merged.workflow || {}),
    ...(presentationStyle ? { presentationStyle } : {}),
  }

  return {
    ...merged,
    boqItems: Array.isArray(merged.boqItems) ? merged.boqItems : [],
    workflow,
    presentationStyle: presentationStyle || workflow.presentationStyle || base.presentationStyle || null,
    pricingConfig: pricingConfig || base.pricingConfig || merged.pricingConfig || null,
  }
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
