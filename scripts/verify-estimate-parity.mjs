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

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
