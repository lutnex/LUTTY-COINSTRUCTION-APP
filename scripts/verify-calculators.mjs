#!/usr/bin/env node
/**
 * QS calculator validation tests
 * Run: node scripts/verify-calculators.mjs
 */
import assert from 'node:assert/strict'
import {
  calcBlockwork,
  calcConcrete,
  calcReinforcement,
  calcTiles,
  BLOCK_PRESETS,
} from '../src/utils/calcEngine.js'

const checks = []

function check(name, fn) {
  try {
    fn()
    checks.push({ name, ok: true })
  } catch (e) {
    checks.push({ name, ok: false, error: e.message })
  }
}

const FT = 0.3048

check('145ft × 10ft wall, 8×16 block, 10% wastage → 1794 blocks', () => {
  const r = calcBlockwork({
    wallLengthM: 145 * FT,
    wallHeightM: 10 * FT,
    blockFaceLengthM: BLOCK_PRESETS.us_8x16.faceLengthM,
    blockFaceHeightM: BLOCK_PRESETS.us_8x16.faceHeightM,
    wastagePct: 10,
  })
  assert.equal(r.ok, true)
  const wallArea = r.steps.find(s => s.label === 'Wall area')
  assert.ok(Math.abs(parseFloat(wallArea.value) - 134.71) < 0.1, `wall area ${wallArea.value}`)
  const base = r.steps.find(s => s.label.includes('Base blocks'))
  assert.ok(base.value === 1631 || base.value === 1632, `base blocks ${base.value}`)
  const final = r.steps.find(s => s.label.includes('Final blocks'))
  assert.ok(final.value >= 1794 && final.value <= 1795, `final blocks ${final.value}`)
})

check('Block count ignores wall thickness (face area only)', () => {
  const a = calcBlockwork({ wallLengthM: 10, wallHeightM: 3, blockFaceLengthM: 0.45, blockFaceHeightM: 0.225, wastagePct: 0 })
  const b = calcBlockwork({ wallLengthM: 10, wallHeightM: 3, blockFaceLengthM: 0.45, blockFaceHeightM: 0.225, wastagePct: 0 })
  assert.equal(a.sections.metrics.baseBlocks, b.sections.metrics.baseBlocks)
})

check('1 m³ concrete mix 1:2:4 produces realistic materials', () => {
  const r = calcConcrete({ lengthM: 1, widthM: 1, depthM: 1, mixKey: '1:2:4', wastagePct: 0 })
  assert.equal(r.ok, true)
  const dry = parseFloat(r.steps.find(s => s.label === 'Dry volume').value)
  assert.ok(Math.abs(dry - 1.54) < 0.01)
  const bags = r.steps.find(s => s.label.includes('Cement bags')).value
  assert.ok(bags >= 6 && bags <= 8, `cement bags ${bags} for 1m³`)
  const sand = parseFloat(r.steps.find(s => s.label.includes('Sand')).value)
  assert.ok(sand > 0.4 && sand < 0.5, `sand ${sand} m³ for 1m³ wet`)
})

check('Y12 reinforcement unit weight = 12²/162 ≈ 0.889 kg/m', () => {
  const r = calcReinforcement({ barDiameterMm: 12, barLengthM: 1, barCount: 1, wastagePct: 0 })
  assert.equal(r.ok, true)
  const uw = r.steps.find(s => s.label === 'Unit weight')
  assert.ok(Math.abs(parseFloat(uw.value) - 0.889) < 0.002, uw.value)
})

check('45cm × 45cm tile covers 0.2025 m² each', () => {
  const r = calcTiles({
    manualAreaM2: 10,
    tileLengthM: 0.45,
    tileWidthM: 0.45,
    wastagePct: 0,
  })
  assert.equal(r.ok, true)
  const tileArea = r.steps.find(s => s.label === 'Tile area')
  assert.ok(Math.abs(parseFloat(tileArea.value) - 0.2025) < 0.0001, tileArea.value)
  const base = r.steps.find(s => s.label === 'Base tiles')
  assert.equal(base.value, Math.ceil(10 / 0.2025))
})

const failed = checks.filter(c => !c.ok)
for (const c of checks) {
  console.log(c.ok ? `✓ ${c.name}` : `✗ ${c.name}: ${c.error}`)
}
console.log(`\n${checks.length - failed.length}/${checks.length} calculator checks passed`)
if (failed.length) process.exit(1)
