/**
 * Legacy calculation exports — delegates to calcEngine.js
 * @deprecated Import from calcEngine.js for structured QS results
 */
import {
  calcBlockwork,
  calcMortarBlockwork,
  calcConcrete,
  calcPlaster,
  calcReinforcement,
  calcTiles,
  calcPaint,
} from './calcEngine.js'

export { calcBlockwork, calcMortarBlockwork, calcConcrete, calcPlaster, calcReinforcement, calcTiles, calcPaint }

export const calcBlocks = (l, h) => {
  const r = calcBlockwork({ wallLengthM: l, wallHeightM: h, blockFaceLengthM: 0.45, blockFaceHeightM: 0.225 })
  if (!r.ok) return null
  const final = r.steps.find(s => s.label.includes('Final blocks'))?.value
  return { 'Wall area (m²)': r.steps[0]?.value?.replace(' m²', ''), 'Blocks (purchase)': final }
}

export const calcRebar = (l, dia, n) => {
  const r = calcReinforcement({ barDiameterMm: dia, barLengthM: l, barCount: n })
  if (!r.ok) return null
  return Object.fromEntries(r.steps.map(s => [s.label, s.value]))
}

export const calcExcavation = (l, w, h) => {
  const vol = parseFloat(l) * parseFloat(w) * parseFloat(h)
  if (!vol) return null
  return {
    'Net volume (m³)': vol.toFixed(2),
    'Bulked volume (m³)': (vol * 1.3).toFixed(2),
    'Truck loads (5m³)': Math.ceil(vol * 1.3 / 5),
  }
}
