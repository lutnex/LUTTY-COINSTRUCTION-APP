/** Document Generator × Variation Order integration types. */

export const REVISED_EXPORT_STYLES = {
  PREMIUM: 'revised_premium',
  DETAILED: 'revised_detailed',
  ADDENDUM: 'variation_addendum',
  FULL: 'full_revised',
}

export const REVISED_EXPORT_LABELS = {
  [REVISED_EXPORT_STYLES.PREMIUM]: 'A. Revised Premium Quotation',
  [REVISED_EXPORT_STYLES.DETAILED]: 'B. Revised Detailed BOQ',
  [REVISED_EXPORT_STYLES.ADDENDUM]: 'C. Variation Addendum Only',
  [REVISED_EXPORT_STYLES.FULL]: 'D. Full Revised Estimate',
}

export const REVISED_EXPORT_DESCRIPTIONS = {
  [REVISED_EXPORT_STYLES.PREMIUM]: 'Summarized client-facing revised quotation with category totals.',
  [REVISED_EXPORT_STYLES.DETAILED]: 'Full item-by-item revision schedule with all line changes.',
  [REVISED_EXPORT_STYLES.ADDENDUM]: 'Shows only variation changes against the original estimate.',
  [REVISED_EXPORT_STYLES.FULL]: 'Original estimate plus all applied variation items.',
}

export const DOCGEN_VARIATION_DRAFT_KEY = 'constructiq-docgen-variation-draft'

export function nextRevisionNumber(existingRevisions = []) {
  const max = existingRevisions.reduce((m, r) => Math.max(m, parseInt(r, 10) || 0), 0)
  return max + 1
}

export function formatRevisionLabel(n) {
  return `Revision ${n}`
}

export function saveVariationDraft(draft) {
  try {
    localStorage.setItem(DOCGEN_VARIATION_DRAFT_KEY, JSON.stringify({
      ...draft,
      savedAt: new Date().toISOString(),
    }))
    return true
  } catch (e) {
    console.error('[docGenVariation] save draft failed', e)
    return false
  }
}

export function loadVariationDraft() {
  try {
    const raw = localStorage.getItem(DOCGEN_VARIATION_DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearVariationDraft() {
  try {
    localStorage.removeItem(DOCGEN_VARIATION_DRAFT_KEY)
  } catch { /* ignore */ }
}

export function createEmptyVariationDraft(base = {}) {
  return {
    originalDocumentId: base.originalDocumentId || null,
    originalSnapshot: base.originalSnapshot || null,
    originalTotal: base.originalTotal || 0,
    originalBoqSnapshot: base.originalBoqSnapshot || [],
    revisionNumber: base.revisionNumber || 1,
    variationOrderId: base.variationOrderId || null,
    variationNumber: base.variationNumber || '',
    items: Array.isArray(base.items) ? base.items : [],
    exportStyle: base.exportStyle || REVISED_EXPORT_STYLES.FULL,
    status: base.status || 'draft',
    userNotes: base.userNotes || '',
    approvedAt: base.approvedAt || null,
    savedAt: base.savedAt || new Date().toISOString(),
  }
}
