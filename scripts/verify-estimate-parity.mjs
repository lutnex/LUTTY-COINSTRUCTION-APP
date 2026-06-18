/**
 * Validates single-source-of-truth estimate parity across modules.
 * Run: node scripts/verify-estimate-parity.mjs
 */

import {
  buildProjectEstimate,
  lockProjectEstimate,
  unlockProjectEstimate,
  validateEstimateParity,
  validateExportGate,
  resolveProjectEstimate,
  isEstimateLocked,
  APPROVAL_MODES,
  ESTIMATE_MISMATCH_MESSAGE,
} from '../src/utils/projectEstimate.js'
import { buildApprovalBreakdown } from '../src/services/pricing/directCostBreakdown.js'
import { buildMaterialAudit, buildImportBaselineFromExtract, reconcileMaterialSchedule } from '../src/utils/materialAudit.js'
import { mergeExtractIntoProjectData, emptyProjectData } from '../src/utils/projectIntelligence.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failed += 1
    console.error(`  ✗ ${name}`)
    console.error(`    ${e.message}`)
  }
}

console.log('Estimate parity verification\n')

test('direct-cost estimate preserves materials + labour + transport', () => {
  const estimate = buildProjectEstimate({
    materials: [{ amount: 64552 }],
    labor: [{ amount: 16169 }],
    equipment: [{ amount: 1000 }],
    source: 'ai-chat',
  })
  assert(Math.abs(estimate.directCostTotal - 81721) < 0.02, `expected 81721, got ${estimate.directCostTotal}`)
  assert(Math.abs(estimate.approvedTotal - 81721) < 0.02, `approved should match direct cost`)
})

test('locked direct-only estimate blocks commercial additions', () => {
  const input = {
    boqRows: [{ amount: 50000 }],
    labor: [{ amount: 10000 }],
  }
  const locked = lockProjectEstimate({}, { modes: [APPROVAL_MODES.DIRECT_ONLY] }, input)
  assert(locked.locked === true, 'should be locked')
  assert(Math.abs(locked.approvedTotal - 60000) < 0.02, `expected 60000, got ${locked.approvedTotal}`)
  assert(locked.contingency.amount === 0, 'no contingency without approval')
})

test('matching module totals pass parity check', () => {
  const est = { locked: true, approvedTotal: 81721 }
  const result = validateEstimateParity({
    chatTotal: 81721,
    boqTotal: 81721,
    docGenTotal: 81721,
    pdfTotal: 81721,
  })
  assert(result.ok, result.mismatches.join('; '))
})

test('mismatched totals block export', () => {
  const locked = { locked: true, approvedTotal: 81721 }
  const parity = validateEstimateParity({
    chatTotal: 81721,
    boqTotal: 90000,
    docGenTotal: 81721,
    pdfTotal: 81721,
  })
  assert(!parity.ok, 'should detect mismatch')
  assert(parity.message === ESTIMATE_MISMATCH_MESSAGE, parity.message)

  const gate = validateExportGate({
    projectEstimate: locked,
    moduleTotals: parity.totals,
  })
  assert(!gate.ok, 'export gate should block')
})

test('export blocked when estimate not locked', () => {
  const gate = validateExportGate({
    projectEstimate: { locked: false, approvedTotal: 1000 },
    moduleTotals: { chatTotal: 1000, boqTotal: 1000, docGenTotal: 1000, pdfTotal: 1000 },
  })
  assert(!gate.ok, 'should require lock')
  assert(gate.requiresApproval, 'should flag approval required')
})

test('unlock restores live recalculation without clearing line items', () => {
  const input = {
    boqRows: [{ amount: 50000 }],
    labor: [{ amount: 10000 }],
  }
  const locked = lockProjectEstimate({}, { modes: [APPROVAL_MODES.DIRECT_ONLY] }, input)
  assert(locked.locked === true)

  const unlocked = unlockProjectEstimate(locked, input)
  assert(unlocked.locked === false, 'should be unlocked')
  assert(unlocked.pricingSnapshot == null, 'snapshot cleared')
  assert(Math.abs(unlocked.approvedTotal - 60000) < 0.02, 'totals still reflect line items')
  assert(unlocked.previousLock?.approvedTotal === locked.approvedTotal, 'preserves lock history')
})

test('resolveProjectEstimate prefers locked snapshot when stores desync', () => {
  const locked = lockProjectEstimate({}, { modes: [APPROVAL_MODES.DIRECT_ONLY] }, {
    boqRows: [{ amount: 1000 }],
  })
  const unlocked = { locked: false, approvedTotal: 9999 }
  const resolved = resolveProjectEstimate(unlocked, locked)
  assert(resolved.locked === true)
  assert(resolved.approvedTotal === locked.approvedTotal)
  assert(isEstimateLocked(unlocked, locked) === true)
})

test('chat import does not double-count labour in unified BOQ and labor array', () => {
  const boqRows = [
    { section: 'Earthworks', amount: 3600 },
    { section: 'Filling Works', amount: 1500 },
    { section: 'Transport', amount: 1000 },
    { section: 'Preliminaries', amount: 4580 },
  ]
  const materials = [{ amount: 64552, desc: 'Materials' }]
  const labor = [{ amount: 18969, trade: 'Masonry' }]
  const unifiedBoq = [
    ...boqRows,
    { section: 'Materials', amount: 64552 },
    { section: 'Labour — Masonry', amount: 18969 },
  ]
  const breakdown = buildApprovalBreakdown({ boqRows: unifiedBoq, materials, labor })
  assert(Math.abs(breakdown.directTotal - 94201) < 0.02, `expected 94201, got ${breakdown.directTotal}`)
  const estimate = buildProjectEstimate({ boqRows: unifiedBoq, materials, labor })
  assert(Math.abs(estimate.directCostTotal - 94201) < 0.02, `estimate expected 94201, got ${estimate.directCostTotal}`)
})

test('raw BOQ + parallel arrays match chat contract sum', () => {
  const input = {
    boqRows: [
      { section: 'Earthworks', amount: 3600 },
      { section: 'Filling Works', amount: 1500 },
      { section: 'Transport', amount: 1000 },
      { section: 'Preliminaries & Contingency', amount: 4580 },
    ],
    materials: [{ amount: 64552 }],
    labor: [{ amount: 18969 }],
  }
  const breakdown = buildApprovalBreakdown(input)
  assert(Math.abs(breakdown.directTotal - 94201) < 0.02, `expected 94201, got ${breakdown.directTotal}`)
  assert(Math.abs(breakdown.categories.materials - 64552) < 0.02)
  assert(Math.abs(breakdown.categories.labour - 18969) < 0.02)
})

test('stale docGen prelims are not added when BOQ already contains preliminaries', () => {
  const input = {
    boqRows: [
      { section: 'Preliminaries', amount: 4580 },
      { section: 'Materials', amount: 1000 },
    ],
    materials: [{ amount: 1000 }],
    prelims: [{ amount: 4580, desc: 'Stale duplicate' }],
  }
  const breakdown = buildApprovalBreakdown(input)
  assert(Math.abs(breakdown.directTotal - 5580) < 0.02, `expected 5580 not double prelims, got ${breakdown.directTotal}`)
})

test('material schedule rows under BOQ bill sections do not inflate Other', () => {
  const materials = [{ amount: 69617, desc: 'Materials total' }]
  const labor = [{ amount: 18969, trade: 'Masonry' }]
  const boqRows = [
    { section: 'Earthworks', amount: 3600 },
    { section: 'Filling Works', amount: 1500 },
    { section: 'Transport', amount: 1000 },
    { section: 'Preliminaries', amount: 4580 },
    { section: 'Bill 2 — Substructure', desc: 'Cement bags', amount: 30000, source: 'ai-material' },
    { section: 'Bill 2 — Substructure', desc: 'Reinforcement', amount: 39617, source: 'ai-material' },
    { section: 'Labour — Masonry', amount: 18969, source: 'ai-labor' },
  ]
  const breakdown = buildApprovalBreakdown({ boqRows, materials, labor })
  assert(breakdown.categories.other === 0, `Other must be 0, got ${breakdown.categories.other}`)
  assert(Math.abs(breakdown.categories.materials - 69617) < 0.02)
  assert(Math.abs(breakdown.directTotal - 99266) < 0.02, `expected 99266, got ${breakdown.directTotal}`)
})

test('BOQ bill rows matching material schedule total do not inflate Other', () => {
  const materials = [{ amount: 69617, desc: 'Materials total' }]
  const boqRows = [
    { section: 'Bill 1 — Superstructure', desc: 'Combined materials', amount: 69617 },
  ]
  const breakdown = buildApprovalBreakdown({ boqRows, materials })
  assert(breakdown.categories.other === 0, `Other must be 0, got ${breakdown.categories.other}`)
  assert(Math.abs(breakdown.categories.materials - 69617) < 0.02)
  assert(Math.abs(breakdown.directTotal - 69617) < 0.02)
})

test('material audit flags extra rows causing schedule difference', () => {
  const baseline = buildImportBaselineFromExtract({
    materials: [
      { desc: 'Cement 42.5R', unit: 'bag', qty: '100', rate: '65', amount: 6500 },
      { desc: 'Sandcrete blocks', unit: 'nr', qty: '500', rate: '12', amount: 6000 },
    ],
    contractSum: 94201,
  })
  assert(Math.abs(baseline.materialTotal - 12500) < 0.02)

  const audit = buildMaterialAudit({
    materials: [
      ...baseline.materials,
      { desc: 'Extra roof sheets', unit: 'sheet', qty: '10', rate: '506.5', amount: 5065, source: 'carried-forward' },
    ],
    importBaseline: baseline,
  })
  assert(Math.abs(audit.difference - 5065) < 0.02, `expected diff 5065, got ${audit.difference}`)
  assert(audit.flaggedRows.some(r => r.flags.includes('extra')), 'should flag extra row')
  assert(Math.abs(audit.flaggedDeltaSum - 5065) < 0.02)
})

test('mergeExtractIntoProjectData reconciles materials to commercial summary', () => {
  const stale = emptyProjectData()
  stale.materials = [
    { id: 1, desc: 'Roof sheets', qty: 10, rate: 506.5, amount: 5065, source: 'carried-forward' },
    { id: 2, desc: 'Cement bags', qty: 100, rate: 645.52, amount: 64552, source: 'ai-chat' },
  ]
  const merged = mergeExtractIntoProjectData(stale, {
    hasBOQ: true,
    materials: stale.materials,
    commercialBreakdown: { materials: 64552, labour: 18969, contractSum: 94201 },
    boqRows: [
      { section: 'Earthworks', desc: 'Bulk excavation', amount: 3600 },
      { section: 'Filling Works', desc: 'Backfill', amount: 1500 },
      { section: 'Transport', desc: 'Delivery', amount: 1000 },
      { section: 'Preliminaries', desc: 'Site setup', amount: 4580 },
    ],
    labor: [{ trade: 'Masonry', desc: 'Blockwork', amount: 18969 }],
  }, { replaceBoq: true })
  assert(Math.abs(merged.materials.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0) - 64552) < 0.02)
  const breakdown = buildApprovalBreakdown({
    boqRows: merged.boqItems,
    materials: merged.materials,
    labor: merged.labor,
    commercialBreakdown: merged.commercialBreakdown,
  })
  assert(Math.abs(breakdown.directTotal - 94201) < 0.02, `expected 94201, got ${breakdown.directTotal}`)
})

test('commercial summary overrides inflated material schedule for pricing', () => {
  const materials = [
    { amount: 64552, desc: 'Valid materials', source: 'ai-chat' },
    { amount: 5065, desc: 'Stale duplicate', source: 'carried-forward' },
  ]
  const breakdown = buildApprovalBreakdown({
    boqRows: [
      { section: 'Earthworks', desc: 'Excavation', amount: 3600 },
      { section: 'Filling Works', desc: 'Backfill', amount: 1500 },
      { section: 'Transport', desc: 'Delivery', amount: 1000 },
      { section: 'Preliminaries', desc: 'Site setup', amount: 4580 },
    ],
    materials,
    labor: [{ trade: 'Masonry', amount: 18969 }],
    commercialBreakdown: {
      materials: 64552,
      labour: 18969,
      earthworks: 3600,
      filling: 1500,
      transport: 1000,
      preliminaries: 4580,
      contractSum: 94201,
    },
  })
  assert(Math.abs(breakdown.categories.materials - 64552) < 0.02)
  assert(Math.abs(breakdown.directTotal - 94201) < 0.02, `expected 94201, got ${breakdown.directTotal}`)
})

test('reconcileMaterialSchedule removes stale rows but keeps valid line items', () => {
  const materials = [
    { id: 1, desc: 'Cement and blocks', amount: 64552, source: 'ai-chat' },
    { id: 2, desc: 'Extra roof sheets', amount: 5065, source: 'carried-forward' },
  ]
  const reconciled = reconcileMaterialSchedule(materials, {
    commercialBreakdown: { materials: 64552 },
  })
  const total = reconciled.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0)
  assert(Math.abs(total - 64552) < 0.02, `expected 64552, got ${total}`)
  assert(reconciled.length === 1, 'stale row should be removed')
})

test('locked estimate uses commercial summary in pricing snapshot for PDF export', () => {
  const input = {
    boqRows: [
      { section: 'Earthworks', desc: 'Excavation', amount: 3600 },
      { section: 'Filling Works', desc: 'Backfill', amount: 1500 },
      { section: 'Transport', desc: 'Delivery', amount: 1000 },
      { section: 'Preliminaries', desc: 'Site setup', amount: 4580 },
    ],
    materials: [{ amount: 69617, desc: 'Inflated schedule total', source: 'ai-chat' }],
    labor: [{ trade: 'Masonry', amount: 18969 }],
    commercialBreakdown: {
      materials: 64552,
      labour: 18969,
      earthworks: 3600,
      filling: 1500,
      transport: 1000,
      preliminaries: 4580,
      contractSum: 94201,
    },
  }
  const locked = lockProjectEstimate({}, { modes: [APPROVAL_MODES.DIRECT_ONLY] }, input)
  assert(locked.locked === true)
  assert(Math.abs(locked.approvedTotal - 94201) < 0.02, `expected 94201, got ${locked.approvedTotal}`)
  assert(Math.abs(locked.pricingSnapshot.summary.sub - 94201) < 0.02)
  assert(Math.abs(locked.pricingSnapshot.summary.mat - 64552) < 0.02)
})

test('material audit detects duplicate imported rows', () => {
  const baseline = buildImportBaselineFromExtract({
    materials: [{ desc: 'Cement bags', unit: 'bag', qty: '50', rate: '100', amount: 5000 }],
  })
  const audit = buildMaterialAudit({
    materials: [
      { desc: 'Cement bags', unit: 'bag', qty: '50', rate: '100', amount: 5000, source: 'ai-chat' },
      { desc: 'Cement bags', unit: 'bag', qty: '50', rate: '100', amount: 5000, source: 'duplicate' },
    ],
    importBaseline: baseline,
  })
  assert(audit.summary.duplicate >= 1, 'should detect duplicate')
  assert(Math.abs(audit.difference - 5000) < 0.02)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
