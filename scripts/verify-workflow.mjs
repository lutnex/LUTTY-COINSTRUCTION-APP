#!/usr/bin/env node
/**
 * Static verification for ConstructIQ workflow upgrades.
 * Run: npm run test
 */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

const checks = []

function check(name, fn) {
  try {
    fn()
    checks.push({ name, ok: true })
  } catch (e) {
    checks.push({ name, ok: false, error: e.message })
  }
}

// ── Session persistence ───────────────────────────────────────────────────
check('sessionStore exports chat + app session helpers', () => {
  const src = read('src/utils/sessionStore.js')
  for (const sym of ['saveChatSession', 'loadChatSession', 'clearChatSession', 'saveAppSession', 'loadAppSession', 'serializeChatMessages']) {
    assert.match(src, new RegExp(`export function ${sym}`))
  }
})

check('useChat loads and persists chat on change', () => {
  const src = read('src/hooks/useChat.js')
  assert.match(src, /loadChatSession/)
  assert.match(src, /saveChatSession/)
  assert.match(src, /clearChatSession/)
  assert.match(src, /persist/)
})

check('chat messages serialize extract for BOQ survival', () => {
  const src = read('src/utils/sessionStore.js')
  assert.match(src, /extract/)
})

check('project intelligence persists to localStorage', () => {
  const src = read('src/context/ProjectIntelligenceContext.jsx')
  assert.match(src, /saveIntelligence/)
  assert.match(src, /loadIntelligence/)
})

check('docgen draft persists to localStorage', () => {
  const src = read('src/utils/boqWorkflow.js')
  assert.match(src, /DOCGEN_STORAGE_KEY/)
  assert.match(src, /saveDocGenDraft/)
})

// ── Material price search ───────────────────────────────────────────────────
check('material price API route exists (server-side)', () => {
  assert.ok(existsSync(join(root, 'api/materials/search.js')))
  assert.ok(existsSync(join(root, 'api/materials/list.js')))
  const search = read('api/materials/search.js')
  assert.match(search, /searchAllMaterialPrices/)
  assert.doesNotMatch(search, /window\./)
})

check('material price search never invents prices', () => {
  const src = read('lib/materialPriceSearch.js')
  assert.match(src, /parseGhsPrice/)
  assert.match(src, /manual_entry_required/)
  assert.doesNotMatch(src, /Math\.random/)
})

check('SEARCHABLE_MATERIALS covers required categories', () => {
  const src = read('lib/materialPriceSearch.js')
  for (const term of ['cement', 'block', 'sand', 'chipping', 'reinforcement', 'tile', 'paint', 'plywood', 'plumbing', 'electrical', 'waterproof', 'adhesive', 'grout', 'roofing']) {
    assert.match(src, new RegExp(term, 'i'), `missing category keyword: ${term}`)
  }
  assert.match(src, /export const SEARCHABLE_MATERIALS/)
})

check('MarketTrendsPage has Search Live Prices button', () => {
  const src = read('src/components/tools/MarketTrendsPage.jsx')
  assert.match(src, /Search Live Prices/i)
  assert.match(src, /materialPricesService/)
})

// ── Workflow buttons ────────────────────────────────────────────────────────
check('WorkflowPanel exposes Review, Premium, Detailed, Export, Save Project', () => {
  const src = read('src/components/chat/WorkflowPanel.jsx')
  for (const label of ['Review', 'Premium Quotation', 'Detailed BOQ', 'Export to Document Generator', 'Save Project', 'Export PDF']) {
    assert.match(src, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

check('SaveProjectDialog has required fields', () => {
  const src = read('src/components/projects/SaveProjectDialog.jsx')
  for (const field of ['Project title', 'Client name', 'Location', 'Description', 'Save Project', 'Cancel']) {
    assert.match(src, new RegExp(field, 'i'))
  }
})

check('SaveDocumentDialog resets form when opened', () => {
  const src = read('src/components/docgen/SaveDocumentDialog.jsx')
  assert.match(src, /useEffect/)
  assert.match(src, /if \(!open\) return/)
})

check('QSExportWorkflow supports initial step and style', () => {
  const src = read('src/components/boq/QSExportWorkflow.jsx')
  assert.match(src, /initialStep/)
  assert.match(src, /initialStyle/)
  assert.match(src, /PRESENTATION_STYLES/)
})

check('App wires SaveProjectDialog and session tab persistence', () => {
  const src = read('src/App.jsx')
  assert.match(src, /SaveProjectDialog/)
  assert.match(src, /handleStartNewProject/)
  assert.match(src, /loadAppSession/)
  assert.match(src, /saveAppSession/)
})

check('supabase schema includes material_prices table', () => {
  const sql = read('supabase/schema.sql')
  assert.match(sql, /material_prices/)
  assert.match(sql, /material_key/)
})

check('price extraction from chat exists', () => {
  const src = read('src/utils/priceExtraction.js')
  assert.match(src, /extractAgreedPricesFromChat/)
  assert.match(src, /AGREED PRICES/i)
})

check('multi-profile price store with conflict detection', () => {
  const src = read('src/utils/priceStore.js')
  assert.match(src, /loadPriceProfileState/)
  assert.match(src, /detectProfileConflicts/)
  assert.match(src, /mergeItemsIntoProfile/)
})

check('Save Prices to Profile dialog exists', () => {
  assert.ok(existsSync(join(root, 'src/components/pricing/SavePricesToProfileDialog.jsx')))
  const src = read('src/components/pricing/SavePricesToProfileDialog.jsx')
  assert.match(src, /Confirm Save to Profile/)
})

check('pricing source selection dialog and QS workflow step', () => {
  assert.ok(existsSync(join(root, 'src/components/pricing/PricingSourceDialog.jsx')))
  const qs = read('src/components/boq/QSExportWorkflow.jsx')
  assert.match(qs, /pricing_source/)
  assert.match(qs, /PRICING_SOURCE_OPTIONS/)
})

check('BOQ audit trail fields on line items', () => {
  const src = read('src/utils/boqItemFactory.js')
  assert.match(src, /rateSourceDetail/)
  assert.match(src, /rateUsedAt/)
  assert.match(src, /rateNotes/)
})

check('price profiles API routes exist', () => {
  assert.ok(existsSync(join(root, 'api/prices/list.js')))
  assert.ok(existsSync(join(root, 'api/prices/save.js')))
})

check('supabase schema includes variation_orders and revised_documents tables', () => {
  const sql = read('supabase/schema.sql')
  assert.match(sql, /variation_orders/)
  assert.match(sql, /revised_documents/)
  assert.match(sql, /variation_items JSONB/)
  assert.match(sql, /document_data JSONB/)
})

check('CalcsPage uses QS calcEngine', () => {
  const src = read('src/components/tools/CalcsPage.jsx')
  assert.match(src, /calcEngine/)
  assert.match(src, /Unit Converter/)
  assert.match(src, /Mortar/)
  assert.match(src, /Wastage/)
})

check('shared DeLuteroits document template exists for all exports', () => {
  assert.ok(existsSync(join(root, 'src/utils/deLuteroitsDocumentTemplate.js')))
  assert.ok(existsSync(join(root, 'src/components/docgen/DeLuteroitsDocumentTemplate.jsx')))
  assert.ok(existsSync(join(root, 'src/utils/htmlToPdf.js')))
  const tpl = read('src/utils/deLuteroitsDocumentTemplate.js')
  assert.match(tpl, /DELUTEROITS_DOCUMENT_STYLES/)
  assert.match(tpl, /wrapDeLuteroitsDocument/)
  assert.match(tpl, /#0A2A43/)
  assert.match(tpl, /#B00020/)
  const exp = read('src/utils/variationExport.js')
  assert.match(exp, /deLuteroitsDocumentTemplate/)
  assert.match(exp, /downloadHtmlAsPdf/)
})

// ── Report ──────────────────────────────────────────────────────────────────
const failed = checks.filter(c => !c.ok)
for (const c of checks) {
  console.log(c.ok ? `✓ ${c.name}` : `✗ ${c.name}: ${c.error}`)
}
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
if (failed.length) process.exit(1)
