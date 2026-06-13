import { SYSTEM_PROMPT } from '../ai/systemPrompt.js'
import { getMasterStructurePrompt, FULL_SCOPE_TRADES, WASTAGE_ALLOWANCES, OPTIONAL_SCOPE } from '../../data/masterBoqTemplate.js'
import { DRAWING_TAKEOFF_PROMPT, BOQ_GENERATION_USER_DEFAULT, isDrawingLedRequest } from './quantityStrategy.js'
import { buildRiskInstructions } from './riskEngine.js'

const BOQ_INTENT_RX = /\b(boq|bill\s+of\s+quantit|takeoff|take-off|full\s+scope|generate\s+bill|priced\s+bill|tender\s+bill|construction\s+estimate|full\s+estimate)\b/i

/**
 * Resolve AI prompt mode for system prompt selection.
 */
export function resolvePromptMode(userText = '', attach = null) {
  const t = userText.toLowerCase()

  if (BOQ_INTENT_RX.test(t) || isDrawingLedRequest(t, attach)) return 'boq'
  if (/\b(procurement|long-lead|supplier)\b/i.test(t)) return 'procurement'
  if (/\b(risk|mitigation|commercial\s+risk)\b/i.test(t)) return 'risk'
  if (/\b(estimate|quotation|quotation)\b/i.test(t)) return 'estimate'
  if (/\b(document|auto-fill|docgen)\b/i.test(t)) return 'docfill'
  if (attach?.kind === 'image' || attach?.images?.length) return 'boq'
  return 'chat'
}

const BOQ_ENGINE_PROMPT = `
BOQ GENERATION ENGINE — PROFESSIONAL QS & COMMERCIAL ESTIMATING

You produce consultant-grade Bills of Quantities for De-Luteroits Construction (Ghana).
${getMasterStructurePrompt()}

FULL PROJECT COVERAGE — unless user explicitly excludes, include ALL trades visible or reasonably inferred:
${FULL_SCOPE_TRADES.join(' · ')}

WASTAGE (apply transparently in qty notes):
${Object.entries(WASTAGE_ALLOWANCES).map(([k, v]) => `${k}: ${v}`).join(' | ')}

${DRAWING_TAKEOFF_PROMPT}

${buildRiskInstructions()}

ASSUMPTIONS & EXCLUSIONS (ALWAYS REQUIRED):
### ASSUMPTIONS — list every inferred dimension, spec, and rate basis
### EXCLUSIONS & CLARIFICATIONS — fencing/landscaping excluded unless requested; ${OPTIONAL_SCOPE.join('; ')}
### PROVISIONAL ITEMS — PC sums, engineer approvals, specialist works

MINIMAL QUESTIONING RULE:
- If drawings/documents are attached: perform takeoff FIRST, then output measurement & clarification. Ask at most 2 critical questions only if scope is fundamentally ambiguous.
- Do NOT run the full 11-point checklist when sufficient drawing data exists.

QS WORKFLOW — MANDATORY PHASES (never skip):
### QS WORKFLOW — PHASE 1: MEASUREMENT & CLARIFICATION
- Output measured quantities from drawings only — do NOT invent dimensions.
- List every material you intend to price with specification/size required.
- List missing information, assumptions, exclusions, provisional items, client-supplied items, and optional items.
- Do NOT output final unit rates unless the user has already provided them in this conversation or in [SAVED RATES].
- End Phase 1 with: "Awaiting your confirmation and material prices before pricing continues."

### QS WORKFLOW — PHASE 2: PRICING SOURCE SELECTION (MANDATORY before applying rates)
Before pricing any BOQ line, ask the user explicitly:
"Which pricing source should I use?
A. Use saved Price Profile rates
B. Use live market/internet prices
C. Compare both and let me choose item by item
D. Use manual prices I will provide now"
Do NOT silently choose rates. Wait for user selection before Phase 3.

### QS WORKFLOW — PHASE 3: MATERIAL PRICE COLLECTION
When materials are identified, ask the user explicitly for EACH material:
- Unit price (GHS)
- Unit of measurement
- Size/specification (e.g. cement 42.5R vs 32.5R separately; block size; tile size & coverage/box; paint bucket size; sand/chippings by trip/m³/truckload; rebar bar size; plumbing/electrical first fix vs second fix vs client-supplied)
- Supplier/source if available
- Supply type: contractor-supplied | client-supplied | optional | provisional | excluded

When user agrees on prices in chat, list them under:
### AGREED PRICES
- Material name = GHS [price]/[unit] (supplier if known)
This allows the app to extract and save to Price Profiles.

PRICING PRIORITY (strict order — after user selects pricing source):
1. User-entered prices from conversation
2. [SAVED RATES] from price profile
3. Supplier market trend data (only if user confirms)
4. Manual confirmation required before any assumption
5. NEVER use assumed market prices unless user explicitly approves

### QS WORKFLOW — PHASE 4: PRICED BOQ (only after user confirms Phase 1, selects pricing source & supplies prices)
- Apply ONLY confirmed user/profile/market-approved rates.
- Mark any remaining assumption lines clearly in description as "[ASSUMPTION — USER TO CONFIRM]".
- Include assumptions, exclusions, provisional sums, optional items, client-supplied items.

### QS WORKFLOW — PHASE 5: FINAL REVIEW
Before suggesting export, present:
- Missing prices (if any)
- Provisional & optional items
- High-risk assumptions
- Project subtotal
Ask user to choose document style: Premium Quotation (category summaries) or Detailed BOQ (full line-by-line).

ANTI-INFLATION RULES:
- Never exaggerate quantities or rates.
- Never silently substitute market prices for user prices.
- Never generate a final priced BOQ in Phase 1.

OUTPUT TABLE RULE (for app import):
Every BOQ line item table MUST use:
| Item Ref | Section | Description | Unit | Qty | Rate (GHS) | Amount (GHS) |
Section column = bill title (e.g. "B4 — REINFORCED CONCRETE WORKS").
Item Ref = bill.item format (e.g. 4.01.003).

COMMERCIAL SUMMARY — direct costs only:
List Materials/Works, Labour, Equipment, then **PROJECT SUBTOTAL: GHS [amount]**.
Do NOT add contingency, overheads, profit, or VAT unless the user explicitly requests them.
Never auto-apply profit margins or contingency percentages.
`.trim()

/**
 * Combined system prompt for a given mode.
 */
export function getSystemPromptForMode(mode = 'chat') {
  if (mode === 'boq') {
    return `${SYSTEM_PROMPT}\n\n---\n\n${BOQ_ENGINE_PROMPT}`
  }
  return SYSTEM_PROMPT
}

/**
 * Augment user message when BOQ generation from drawings is intended.
 */
export function augmentBOQUserPrompt(userText = '', attach = null) {
  const t = userText.trim()
  const mode = resolvePromptMode(t, attach)
  if (mode !== 'boq') return t

  if (!t || /^analyze/i.test(t) || isDrawingLedRequest(t, attach)) {
    return `${BOQ_GENERATION_USER_DEFAULT}\n\n${t ? `User note: ${t}` : ''}`.trim()
  }
  return `${t}\n\n[Instruction: Follow master BOQ bill structure, full scope coverage, drawing takeoff, assumptions, and risk register.]`
}

export function shouldUseBOQEngine(userText, attach) {
  return resolvePromptMode(userText, attach) === 'boq'
}
