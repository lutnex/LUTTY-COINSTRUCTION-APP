/** Parse AI responses into variation line items. */

import {
  CHANGE_TYPES,
  ITEM_STATUSES,
  normalizeVariationItem,
} from './variationOrderTypes.js'

const CHANGE_TYPE_MAP = {
  addition: CHANGE_TYPES.ADDITION,
  add: CHANGE_TYPES.ADDITION,
  new: CHANGE_TYPES.ADDITION,
  omission: CHANGE_TYPES.OMISSION,
  removal: CHANGE_TYPES.OMISSION,
  remove: CHANGE_TYPES.OMISSION,
  deleted: CHANGE_TYPES.OMISSION,
  reduction: CHANGE_TYPES.REDUCTION,
  reduce: CHANGE_TYPES.REDUCTION,
  decrease: CHANGE_TYPES.REDUCTION,
  increase: CHANGE_TYPES.INCREASE,
  substitution: CHANGE_TYPES.SUBSTITUTION,
  substitute: CHANGE_TYPES.SUBSTITUTION,
  replaced: CHANGE_TYPES.SUBSTITUTION,
  'rate adjustment': CHANGE_TYPES.RATE_ADJUSTMENT,
  rate: CHANGE_TYPES.RATE_ADJUSTMENT,
  'quantity adjustment': CHANGE_TYPES.QUANTITY_ADJUSTMENT,
  quantity: CHANGE_TYPES.QUANTITY_ADJUSTMENT,
  provisional: CHANGE_TYPES.PROVISIONAL,
  'client-supplied': CHANGE_TYPES.CLIENT_SUPPLIED,
  'client supplied': CHANGE_TYPES.CLIENT_SUPPLIED,
  optional: CHANGE_TYPES.OPTIONAL,
}

function mapChangeType(raw) {
  const key = String(raw || '').toLowerCase().trim()
  return CHANGE_TYPE_MAP[key] || CHANGE_TYPES.ADDITION
}

function mapStatus(raw) {
  const s = String(raw || '').toLowerCase().trim()
  if (/tbc|to be confirmed|unclear|pending price/i.test(s)) return ITEM_STATUSES.TBC
  if (/approved/i.test(s)) return ITEM_STATUSES.APPROVED
  if (/rejected/i.test(s)) return ITEM_STATUSES.REJECTED
  if (/optional/i.test(s)) return ITEM_STATUSES.OPTIONAL
  return ITEM_STATUSES.PENDING
}

function parseTableRow(cells) {
  if (!cells.length || cells.every(c => !c.trim())) return null
  const lower = cells.map(c => c.toLowerCase())
  if (lower.some(c => /change type|description of change|item no/i.test(c))) return null

  const item = {
    originalItemRef: cells[1] || cells[0] || '',
    description: cells[2] || cells[1] || '',
    changeType: mapChangeType(cells[3] || cells[2]),
    originalQty: cells[4] || '',
    revisedQty: cells[5] || '',
    unit: cells[6] || 'nr',
    originalRate: cells[7] || '',
    revisedRate: cells[8] || '',
    originalAmount: cells[9] || '',
    revisedAmount: cells[10] || '',
    difference: cells[11] || '',
    reason: cells[12] || '',
    status: mapStatus(cells[13] || cells[12]),
    notes: cells[14] || cells[13] || '',
  }

  if (!item.description && !item.originalItemRef) return null
  return normalizeVariationItem(item)
}

export function parseVariationTableFromText(text) {
  if (!text) return []
  const items = []
  const lines = text.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) continue
    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map(c => c.replace(/\*\*/g, '').trim())
    const row = parseTableRow(cells)
    if (row) items.push(row)
  }

  return items
}

export function buildVariationAIPrompt({ estimateText, clientChanges, existingItems = [] }) {
  const existingSummary = existingItems.length
    ? `\n\nExisting variation items already captured:\n${existingItems.map(i => `- ${i.description} (${i.changeType})`).join('\n')}`
    : ''

  return `You are a Quantity Surveyor preparing a formal Variation Order schedule.

ORIGINAL ESTIMATE / BOQ:
${estimateText || '(No estimate document provided — ask the user to describe the original items)'}

CLIENT INSTRUCTIONS / CHANGES REQUESTED:
${clientChanges || '(User has not yet described changes — ask what was added, removed, reduced, substituted, or changed)'}

RULES — follow strictly:
1. NEVER remove or reduce any item without explicit user confirmation. Flag removals as "Pending confirmation".
2. Ask for missing prices, quantities, and units before finalising.
3. Mark unclear or unpriced items as status "To Be Confirmed" (TBC).
4. Classify each line as one of: Addition, Omission/Removal, Reduction, Increase, Substitution, Rate Adjustment, Quantity Adjustment, Provisional Item, Client-Supplied Change, Optional Item.
5. Preserve original estimate reference numbers where known.
6. Do NOT overwrite the original estimate — this is a separate variation schedule.
${existingSummary}

Respond with:
1. A brief summary of what you understood
2. Any clarifying questions (especially for removals/reductions and missing prices)
3. A variation schedule table in this exact markdown format:

| Item No. | Original Ref | Description of Change | Change Type | Orig Qty | Rev Qty | Unit | Orig Rate | Rev Rate | Orig Amount | Rev Amount | Difference | Reason | Status | Notes |
|----------|-------------|----------------------|-------------|----------|---------|------|-----------|----------|-------------|------------|------------|--------|--------|-------|

Use GHS amounts. Difference = Rev Amount − Orig Amount (negative for reductions/omissions).`
}

export function extractVariationFromAIResponse(text) {
  const items = parseVariationTableFromText(text)
  const hasRemovals = items.some(i =>
    i.changeType === CHANGE_TYPES.OMISSION || i.changeType === CHANGE_TYPES.REDUCTION,
  )
  const hasTBC = items.some(i => i.status === ITEM_STATUSES.TBC || i.tbc)
  const questions = []
  const questionLines = text.split('\n').filter(l => /\?/.test(l) && !l.trim().startsWith('|'))
  questions.push(...questionLines.slice(0, 8))

  return {
    items,
    hasRemovals,
    hasTBC,
    questions,
    summary: text.split('\n').filter(l => l.trim() && !l.startsWith('|')).slice(0, 6).join('\n'),
  }
}
