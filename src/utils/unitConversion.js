/** Supported units — all internal calculations use metric (m, m², m³, kg). */

export const LENGTH_UNITS = ['mm', 'cm', 'm', 'inch', 'ft', 'yd']
export const AREA_UNITS = ['mm2', 'cm2', 'm2', 'ft2', 'acre', 'hectare']
export const VOLUME_UNITS = ['mm3', 'cm3', 'm3', 'litre', 'ft3', 'gallon']
export const WEIGHT_UNITS = ['kg', 'tonne', 'lb']
export const THICKNESS_UNITS = ['mm', 'inch']

export const UNIT_LABELS = {
  mm: 'mm', cm: 'cm', m: 'm', inch: 'in', ft: 'ft', yd: 'yd',
  mm2: 'mm²', cm2: 'cm²', m2: 'm²', ft2: 'ft²', acre: 'acre', hectare: 'ha',
  mm3: 'mm³', cm3: 'cm³', m3: 'm³', litre: 'L', ft3: 'ft³', gallon: 'gal',
  kg: 'kg', tonne: 't', lb: 'lb',
}

const TO_METERS = {
  mm: 0.001, cm: 0.01, m: 1, inch: 0.0254, ft: 0.3048, yd: 0.9144,
}

const TO_M2 = {
  mm2: 1e-6, cm2: 1e-4, m2: 1, ft2: 0.09290304, acre: 4046.8564224, hectare: 10000,
}

const TO_M3 = {
  mm3: 1e-9, cm3: 1e-6, m3: 1, litre: 0.001, ft3: 0.028316846592, gallon: 0.003785411784,
}

const TO_KG = {
  kg: 1, tonne: 1000, lb: 0.45359237,
}

export function isValidLengthUnit(unit) { return LENGTH_UNITS.includes(unit) }
export function isValidAreaUnit(unit) { return AREA_UNITS.includes(unit) }
export function isValidVolumeUnit(unit) { return VOLUME_UNITS.includes(unit) }
export function isValidWeightUnit(unit) { return WEIGHT_UNITS.includes(unit) }

export function convertLength(value, fromUnit, toUnit) {
  const v = parseFloat(value)
  if (!isFinite(v) || !TO_METERS[fromUnit] || !TO_METERS[toUnit]) return NaN
  return (v * TO_METERS[fromUnit]) / TO_METERS[toUnit]
}

export function convertArea(value, fromUnit, toUnit) {
  const v = parseFloat(value)
  if (!isFinite(v) || !TO_M2[fromUnit] || !TO_M2[toUnit]) return NaN
  return (v * TO_M2[fromUnit]) / TO_M2[toUnit]
}

export function convertVolume(value, fromUnit, toUnit) {
  const v = parseFloat(value)
  if (!isFinite(v) || !TO_M3[fromUnit] || !TO_M3[toUnit]) return NaN
  return (v * TO_M3[fromUnit]) / TO_M3[toUnit]
}

export function convertWeight(value, fromUnit, toUnit) {
  const v = parseFloat(value)
  if (!isFinite(v) || !TO_KG[fromUnit] || !TO_KG[toUnit]) return NaN
  return (v * TO_KG[fromUnit]) / TO_KG[toUnit]
}

export function convertThicknessToMeters(value, unit) {
  if (unit === 'mm') return parseFloat(value) * 0.001
  if (unit === 'inch') return parseFloat(value) * 0.0254
  return parseFloat(value)
}

/** @deprecated use convertLength — kept for compatibility */
export function convertUnit(value, fromUnit, toUnit) {
  return convertLength(value, fromUnit, toUnit)
}

export function toMeters(value, fromUnit) {
  return convertLength(value, fromUnit, 'm')
}

export function fromMeters(meters, toUnit) {
  return convertLength(meters, 'm', toUnit)
}

export function toM2(value, fromUnit) {
  return convertArea(value, fromUnit, 'm2')
}

export function fmtDim(n, decimals = 4) {
  if (!isFinite(n)) return '—'
  const s = n.toFixed(decimals)
  return s.replace(/\.?0+$/, '') || '0'
}

export function conversionLabel(value, fromUnit, meters) {
  if (!isFinite(meters)) return ''
  return `${fmtDim(parseFloat(value) || 0)} ${UNIT_LABELS[fromUnit] || fromUnit} → ${fmtDim(meters)} m`
}

export function validateDimension(value, unit, { label = 'Dimension', minM = 0, maxM = 500 } = {}) {
  const raw = String(value ?? '').trim()
  if (raw === '') return { ok: false, error: `${label} is required` }
  const v = parseFloat(raw)
  if (!isFinite(v) || v <= 0) return { ok: false, error: `${label} must be a positive number` }
  if (!isValidLengthUnit(unit)) return { ok: false, error: `${label}: invalid unit "${unit}"` }

  const meters = toMeters(v, unit)
  if (!isFinite(meters) || meters <= minM) return { ok: false, error: `${label} is too small` }
  if (meters > maxM) return { ok: false, error: `${label} exceeds ${maxM} m — check unit selection` }

  return { ok: true, meters, entered: v, unit }
}

export function validateArea(value, unit, { label = 'Area', minM2 = 0, maxM2 = 50000 } = {}) {
  const raw = String(value ?? '').trim()
  if (raw === '') return { ok: false, error: `${label} is required` }
  const v = parseFloat(raw)
  if (!isFinite(v) || v < 0) return { ok: false, error: `${label} must be zero or positive` }
  if (!isValidAreaUnit(unit)) return { ok: false, error: `${label}: invalid unit` }
  const m2 = toM2(v, unit)
  if (m2 > maxM2) return { ok: false, error: `${label} is too large` }
  return { ok: true, m2, entered: v, unit }
}

export const DEFAULT_DIM = (unit = 'm') => ({ value: '', unit })

export function resolveDimensions(fields, state) {
  const converted = {}
  const display = {}
  const errors = []

  for (const { key, label, kind = 'length' } of fields) {
    const dim = state[key] || DEFAULT_DIM()
    if (kind === 'area') {
      const res = validateArea(dim.value, dim.unit, { label })
      if (!res.ok) { errors.push(res.error); continue }
      converted[key] = res.m2
      display[key] = { entered: res.entered, unit: dim.unit, meters: res.m2, label: `${res.entered} ${UNIT_LABELS[dim.unit]} → ${fmtDim(res.m2)} m²` }
      continue
    }
    const maxM = kind === 'thickness' ? 2 : 500
    const minM = kind === 'thickness' ? 0.0001 : 0.001
    const res = validateDimension(dim.value, dim.unit, { label, minM, maxM })
    if (!res.ok) { errors.push(res.error); continue }
    converted[key] = res.meters
    display[key] = { entered: res.entered, unit: dim.unit, meters: res.meters, label: conversionLabel(dim.value, dim.unit, res.meters) }
  }

  return { converted, display, errors, ok: errors.length === 0 }
}

/** General unit converter for the standalone tool. */
export function convertGeneral(type, value, fromUnit, toUnit) {
  const v = parseFloat(value)
  if (!isFinite(v)) return { ok: false, error: 'Enter a valid number' }
  let result
  switch (type) {
    case 'length': result = convertLength(v, fromUnit, toUnit); break
    case 'area': result = convertArea(v, fromUnit, toUnit); break
    case 'volume': result = convertVolume(v, fromUnit, toUnit); break
    case 'weight': result = convertWeight(v, fromUnit, toUnit); break
    case 'thickness': {
      const m = convertThicknessToMeters(v, fromUnit)
      result = toUnit === 'mm' ? m * 1000 : m / 0.0254
      break
    }
    default: return { ok: false, error: 'Unknown conversion type' }
  }
  if (!isFinite(result)) return { ok: false, error: 'Invalid units' }
  return { ok: true, input: v, fromUnit, toUnit, result, formula: `${v} ${fromUnit} → ${fmtDim(result, 6)} ${toUnit}` }
}

export const CONVERTER_GROUPS = {
  length: { units: LENGTH_UNITS, defaultFrom: 'ft', defaultTo: 'm' },
  area: { units: AREA_UNITS, defaultFrom: 'ft2', defaultTo: 'm2' },
  volume: { units: VOLUME_UNITS, defaultFrom: 'ft3', defaultTo: 'm3' },
  weight: { units: WEIGHT_UNITS, defaultFrom: 'kg', defaultTo: 'tonne' },
  thickness: { units: THICKNESS_UNITS, defaultFrom: 'mm', defaultTo: 'inch' },
}
