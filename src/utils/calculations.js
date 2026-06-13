import { MIX_RATIOS } from './constants.js'

/** All dimension inputs must be in meters before calling these functions. */

export const calcConcrete = (l, w, h, mix, waste = 0.05) => {
  const vol = parseFloat(l) * parseFloat(w) * parseFloat(h)
  if (!vol) return null
  const r  = MIX_RATIOS[mix] || MIX_RATIOS['1:2:4']
  const wv = vol * (1 + waste)
  return {
    'Volume (m³)':           vol.toFixed(3),
    'With 5% waste (m³)':    wv.toFixed(3),
    'Cement bags':           Math.ceil(wv * r.c),
    'Sand (m³)':             (wv * r.s).toFixed(2),
    'Aggregate (m³)':        (wv * r.a).toFixed(2),
    'Mix grade':             r.grade,
    'Cement grade':          r.cement,
  }
}

export const calcBlocks = (l, h, thicknessM = 0.15) => {
  const thickMm = thicknessM * 1000
  const blockDepth = thickMm >= 140 ? 0.45 : 0.225
  const perM2 = 1 / (blockDepth + 0.01) / (0.225 + 0.01)
  const area  = parseFloat(l) * parseFloat(h)
  if (!area) return null
  return {
    'Wall thickness (mm)':     thickMm.toFixed(0),
    'Wall area (m²)':         area.toFixed(2),
    'Blocks (incl. 10% waste)': Math.ceil(area * perM2 * 1.10),
    'Mortar bags':            Math.ceil(area * 0.22),
  }
}

export const calcPlaster = (l, h, thicknessM, waste = 0.10) => {
  const area = parseFloat(l) * parseFloat(h)
  if (!area || !thicknessM) return null
  const vol = area * thicknessM * (1 + waste)
  return {
    'Plaster area (m²)':       area.toFixed(2),
    'Thickness (mm)':          (thicknessM * 1000).toFixed(1),
    'Render volume (m³)':      vol.toFixed(3),
    'Cement bags (32.5R)':     Math.ceil(vol / 0.018),
    'Sand (m³)':               (vol * 0.85).toFixed(2),
    'Waste allowance':         `${waste * 100}%`,
  }
}

export const calcRebar = (l, dia, n) => {
  const weights = { 8: 0.395, 10: 0.617, 12: 0.888, 16: 1.578, 20: 2.469, 25: 3.854 }
  const kg = (parseFloat(l) || 0) * 1.12 * (weights[parseInt(dia)] || 1) * (parseFloat(n) || 0)
  if (!kg) return null
  return {
    'Bar length used (m)':     parseFloat(l).toFixed(3),
    'Bar diameter (mm)':       dia,
    'Number of bars':          n,
    'Total weight (kg)':       kg.toFixed(1),
    'Total weight (tonnes)':   (kg / 1000).toFixed(3),
    'Binding wire (kg)':       (kg * 0.01).toFixed(1),
  }
}

export const calcTiles = (l, w, wastePct = 12) => {
  const area = parseFloat(l) * parseFloat(w)
  if (!area) return null
  const tiles = Math.ceil((area / (0.6 * 0.6)) * (1 + wastePct / 100))
  return {
    'Floor area (m²)':              area.toFixed(2),
    'Tiles 600×600 (12% waste)':  tiles,
    'Boxes of 5':                   Math.ceil(tiles / 5),
    'Tile adhesive bags':           Math.ceil(area / 3),
  }
}

export const calcPaint = (l, w, coats = 2) => {
  const area = parseFloat(l) * parseFloat(w)
  if (!area) return null
  const liters = Math.ceil((area * coats / 10) * 1.1)
  return {
    'Area (m²)':                  area.toFixed(2),
    'Paint (litres, 2 coats)':    liters,
    '5L buckets':                 Math.ceil(liters / 5),
    'Primer (5L buckets)':        Math.ceil(area / 80),
  }
}

export const calcExcavation = (l, w, h) => {
  const vol = parseFloat(l) * parseFloat(w) * parseFloat(h)
  if (!vol) return null
  return {
    'Net volume (m³)':    vol.toFixed(2),
    'Bulked volume (m³)': (vol * 1.3).toFixed(2),
    'Truck loads (5m³)':  Math.ceil(vol * 1.3 / 5),
  }
}
