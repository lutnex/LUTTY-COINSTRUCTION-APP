/**
 * Verify chat extract imports full line items (not commercial summary totals only).
 * Run: node scripts/verify-chat-import.mjs
 */

import { parseAIResponse } from '../src/services/ai/responseParser.js'
import { consolidateExtractForImport, isCommercialSummaryRow } from '../src/utils/chatExtract.js'
import { mergeExtractIntoProjectData, emptyProjectData } from '../src/utils/projectIntelligence.js'

const SAMPLE_CHAT = `
### PROJECT SUMMARY
Four-bedroom residence — Accra

### MATERIAL BREAKDOWN
| Section | Description | Unit | Qty | Rate (GHS) | Amount (GHS) |
|---------|-------------|------|-----|------------|--------------|
| Masonry Works | Cement 42.5R | bag | 120 | 110 | 13200 |
| Masonry Works | Sandcrete blocks 6" | nr | 2400 | 8.5 | 20400 |
| Concrete Works | Chippings | m³ | 18 | 450 | 8100 |

### LABOUR BREAKDOWN
| Trade | Description | Unit | Qty | Rate (GHS) | Amount (GHS) |
|-------|-------------|------|-----|------------|--------------|
| Mason | Blockwork to walls | m² | 320 | 45 | 14400 |
| Carpenter | Formwork to beams | m² | 85 | 55 | 4675 |

### Bill of Quantities
| Item Ref | Section | Description | Unit | Qty | Rate (GHS) | Amount (GHS) |
|----------|---------|-------------|------|-----|------------|--------------|
| 4.01.001 | B4 — CONCRETE | Blinding concrete 50mm | m² | 120 | 85 | 10200 |
| 4.01.002 | B4 — CONCRETE | RC ground slab 150mm | m³ | 18 | 920 | 16560 |

### COMMERCIAL SUMMARY
| Item | Amount (GHS) |
|------|--------------|
| Materials / Works Subtotal | 87535 |
| Labour | 19075 |
| PROJECT SUBTOTAL | 106610 |
`

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

console.log('Chat import verification\n')

test('parser excludes commercial summary rows from line items', () => {
  const parsed = parseAIResponse(SAMPLE_CHAT)
  if (parsed.boqRows.some(r => isCommercialSummaryRow(r.desc))) {
    throw new Error('Commercial summary rows leaked into BOQ')
  }
  if (parsed.materials.length < 3) throw new Error(`Expected 3 material rows, got ${parsed.materials.length}`)
  if (parsed.labor.length < 2) throw new Error(`Expected 2 labour rows, got ${parsed.labor.length}`)
  if (parsed.boqRows.length < 2) throw new Error(`Expected 2 BOQ rows, got ${parsed.boqRows.length}`)
})

test('consolidate merges BOQ, materials, and labour for import', () => {
  const parsed = parseAIResponse(SAMPLE_CHAT)
  const c = consolidateExtractForImport(parsed)
  if (c.counts.materials < 3) throw new Error(`materials count ${c.counts.materials}`)
  if (c.counts.labor < 2) throw new Error(`labor count ${c.counts.labor}`)
  if (c.counts.boq < 2) throw new Error(`boq count ${c.counts.boq}`)
  if (c.counts.total < 7) throw new Error(`total unified count ${c.counts.total}`)
})

test('merge into intelligence preserves all detail arrays', () => {
  const parsed = parseAIResponse(SAMPLE_CHAT)
  const merged = mergeExtractIntoProjectData(emptyProjectData(), parsed, { replaceBoq: true })
  if (merged.materials.length < 3) throw new Error(`intelligence materials ${merged.materials.length}`)
  if (merged.labor.length < 2) throw new Error(`intelligence labor ${merged.labor.length}`)
  if (merged.boqItems.length < 7) throw new Error(`intelligence boqItems ${merged.boqItems.length}`)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
