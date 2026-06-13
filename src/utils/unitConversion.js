/** Supported length units — all internal calculations use meters. */
export const LENGTH_UNITS = ['mm', 'cm', 'm', 'inch', 'ft']

export const UNIT_LABELS = {
  mm:   'mm',
  cm:   'cm',
  m:    'm',
  inch: 'in',
  ft:   'ft',
}

/** Conversion factors: multiply value in `unit` to get meters. */
const TO_METERS = {
  mm:   0.001,
  cm:   0.01,
  m:    1,
  inch: 0.0254,
  ft:   0.3048,
}

export function isValidUnit(unit) {
  return LENGTH_UNITS.includes(unit)
}

/**
 * Convert a numeric value between length units.
 * @returns {number} converted value, or NaN if invalid
 */
export function convertUnit(value, fromUnit, toUnit) {
  const v = parseFloat(value)
  if (!isFinite(v) || !isValidUnit(fromUnit) || !isValidUnit(toUnit)) return NaN
  const meters = v * TO_METERS[fromUnit]
  return meters / TO_METERS[toUnit]
}

/** Convert any supported unit → meters (internal standard). */
export function toMeters(value, fromUnit) {
  return convertUnit(value, fromUnit, 'm')
}

/** Convert meters → display unit. */
export function fromMeters(meters, toUnit) {
  return convertUnit(meters, 'm', toUnit)
}

/** Format a number for display (trim trailing zeros). */
export function fmtDim(n, decimals = 4) {
  if (!isFinite(n)) return '—'
  const s = n.toFixed(decimals)
  return s.replace(/\.?0+$/, '') || '0'
}

/**
 * Build a conversion summary line for UI.
 * e.g. "3 ft → 0.9144 m"
 */
export function conversionLabel(value, fromUnit, meters) {
  if (!isFinite(meters)) return ''
  return `${fmtDim(parseFloat(value) || 0)} ${UNIT_LABELS[fromUnit]} → ${fmtDim(meters)} m`
}

/**
 * Validate dimension input before calculation.
 * @returns {{ ok: boolean, error?: string, meters?: number }}
 */
export function validateDimension(value, unit, { label = 'Dimension', minM = 0, maxM = 500 } = {}) {
  const raw = String(value ?? '').trim()
  if (raw === '') return { ok: false, error: `${label} is required` }
  const v = parseFloat(raw)
  if (!isFinite(v) || v <= 0) return { ok: false, error: `${label} must be a positive number` }
  if (!isValidUnit(unit)) return { ok: false, error: `${label}: invalid unit "${unit}"` }

  const meters = toMeters(v, unit)
  if (!isFinite(meters) || meters <= minM) return { ok: false, error: `${label} is too small` }
  if (meters > maxM) return { ok: false, error: `${label} exceeds ${maxM} m — check unit selection` }

  return { ok: true, meters, entered: v, unit }
}

/** Thickness fields default to mm; plan dimensions default to m. */
export const DEFAULT_DIM = (unit = 'm') => ({ value: '', unit })

export function resolveDimensions(fields, state) {
  const converted = {}
  const display = {}
  const errors = []

  for (const { key, label, kind = 'length' } of fields) {
    const dim = state[key] || DEFAULT_DIM()
    const maxM = kind === 'thickness' ? 2 : 500
    const minM = kind === 'thickness' ? 0.0001 : 0.001
    const res = validateDimension(dim.value, dim.unit, { label, minM, maxM })
    if (!res.ok) {
      errors.push(res.error)
      continue
    }
    converted[key] = res.meters
    display[key] = {
      entered: res.entered,
      unit: dim.unit,
      meters: res.meters,
      label: conversionLabel(dim.value, dim.unit, res.meters),
    }
  }

  return { converted, display, errors, ok: errors.length === 0 }
}
