/**
 * Validates Document Generator export HTML includes all line items from state.
 * Run: node scripts/verify-export-parity.mjs
 */

import { buildDocumentHTML } from '../src/services/ai/pdfEngine.js'
import {
  countDocumentExportItems,
  countHtmlExportItems,
  validateExportItemParity,
} from '../src/utils/exportItemCounts.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function makeLongDocument(rowCount = 120) {
  const boqRows = []
  const sections = ['Substructure', 'Superstructure', 'Finishes', 'MEP']
  for (let i = 0; i < rowCount; i += 1) {
    boqRows.push({
      section: sections[i % sections.length],
      desc: `BOQ line item ${i + 1}`,
      unit: 'm²',
      qty: String(10 + (i % 5)),
      rate: 150 + i,
      amount: (10 + (i % 5)) * (150 + i),
    })
  }

  const materials = Array.from({ length: 40 }, (_, i) => ({
    desc: `Material ${i + 1}`,
    unit: 'bag',
    qty: String(i + 2),
    rate: 45 + i,
    amount: (i + 2) * (45 + i),
    categoryId: i % 4 === 0 ? 'cat-a' : 'cat-b',
  }))

  const matCategories = [
    { id: 'cat-a', name: 'Cement & Aggregates' },
    { id: 'cat-b', name: 'Finishes' },
  ]

  const labor = Array.from({ length: 15 }, (_, i) => ({
    trade: 'Mason',
    desc: `Labour task ${i + 1}`,
    qty: String(3 + i),
    rate: 80,
    amount: (3 + i) * 80,
  }))

  const prelims = [
    { item: 'Site setup', amount: 5000 },
    { item: 'Insurance', amount: 2500 },
  ]

  const variations = Array.from({ length: 8 }, (_, i) => ({
    originalItemRef: `VO-${i + 1}`,
    changeType: 'addition',
    description: `Variation line ${i + 1}`,
    originalQty: '0',
    revisedQty: String(i + 1),
    unit: 'item',
    originalRate: 0,
    revisedRate: 1000 + i * 100,
    difference: (i + 1) * (1000 + i * 100),
    reason: 'Client request',
  }))

  return {
    type: 'estimate',
    meta: {
      quoteNum: 'EST-LONG-001',
      date: '2026-06-01',
      validDays: 30,
      clientName: 'Test Client Ltd',
      projectTitle: 'Long Document Export Test',
      paymentTerms: [
        '30% mobilization deposit before work commences.',
        'Balance payable upon practical completion.',
      ],
    },
    boqRows,
    materials,
    matCategories,
    labor,
    prelims,
    variations,
    assumptions: ['Works during dry season', 'Client provides water on site'],
    exclusions: ['VAT', 'Professional fees'],
    documentSections: undefined,
    exportedAt: new Date().toISOString(),
  }
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

console.log('Export parity verification\n')

test('long document HTML includes all BOQ, material, labour, variation rows', () => {
  const data = makeLongDocument(120)
  const html = buildDocumentHTML(data)
  const model = countDocumentExportItems(data)
  const rendered = countHtmlExportItems(html)
  const parity = validateExportItemParity(data, html)

  assert(model.boqRows === 120, `expected 120 BOQ rows in model, got ${model.boqRows}`)
  assert(model.materialRows === 40, `expected 40 material rows, got ${model.materialRows}`)
  assert(model.laborRows === 15, `expected 15 labour rows, got ${model.laborRows}`)
  assert(model.variationRows === 8, `expected 8 variation rows, got ${model.variationRows}`)
  assert(rendered.dataRows >= model.totalLineItems, `HTML data rows ${rendered.dataRows} < model ${model.totalLineItems}`)
  assert(parity.ok, parity.errors.join('; '))
  assert(html.includes('Payment Terms'), 'missing payment terms')
  assert(html.includes('Variation line 1') || html.includes('Revision'), 'missing variations')
  assert(html.includes('sig-box') || html.includes('Client Authorised'), 'missing signature block')
  assert(html.includes('FINAL CONTRACT SUM') || html.includes('Commercial Summary'), 'missing commercial summary')
})

test('ordered sections still include variation appendix', () => {
  const data = makeLongDocument(20)
  data.documentSections = [
    { id: '1', type: 'client_info', title: 'Client Information', enabled: true, status: 'active', html: '' },
    { id: '2', type: 'boq', title: 'Bill of Quantities', enabled: true, status: 'active', html: '' },
    { id: '3', type: 'commercial', title: 'Commercial Summary', enabled: true, status: 'active', html: '' },
    { id: '4', type: 'payment_terms', title: 'Payment Terms', enabled: true, status: 'active', html: '' },
  ]
  const html = buildDocumentHTML(data)
  const parity = validateExportItemParity(data, html)
  assert(html.includes('Variation line 1') || html.includes('Revision'), 'variations missing when using ordered sections')
  assert(parity.ok, parity.errors.join('; '))
})

test('premium summary counts category rows not individual BOQ lines', () => {
  const data = makeLongDocument(50)
  data.presentationStyle = 'premium'
  data.boqCategorySummaries = [
    { section: 'Substructure', summaryDesc: 'Foundations', subtotal: 100000 },
    { section: 'Superstructure', summaryDesc: 'Frame', subtotal: 200000 },
  ]
  const model = countDocumentExportItems(data)
  assert(model.boqRows === 2, `premium summary should count 2 categories, got ${model.boqRows}`)
  const html = buildDocumentHTML(data)
  const parity = validateExportItemParity(data, html)
  assert(parity.ok, parity.errors.join('; '))
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
