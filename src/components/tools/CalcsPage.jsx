import { useState, useCallback } from 'react'
import { C, MIX_RATIOS } from '../../utils/constants.js'
import { Button } from '../shared/Button.jsx'
import { DEFAULT_DIM, resolveDimensions } from '../../utils/unitConversion.js'
import {
  calcConcrete, calcBlocks, calcPlaster, calcRebar, calcTiles, calcPaint,
} from '../../utils/calculations.js'

const UNIT_OPTIONS = ['mm', 'cm', 'm', 'inch', 'ft']

const CALC_TYPES = [
  { id: 'concrete',      label: 'Concrete' },
  { id: 'blocks',        label: 'Blocks' },
  { id: 'plaster',       label: 'Plaster' },
  { id: 'reinforcement', label: 'Reinforcement' },
  { id: 'tiles',         label: 'Tiles' },
  { id: 'paint',         label: 'Paint' },
]

const FIELD_CONFIG = {
  concrete: [
    { key: 'length', label: 'Length', kind: 'length', defaultUnit: 'm' },
    { key: 'width',  label: 'Width',  kind: 'length', defaultUnit: 'm' },
    { key: 'depth',  label: 'Depth / height', kind: 'length', defaultUnit: 'm' },
  ],
  blocks: [
    { key: 'length',    label: 'Wall length', kind: 'length', defaultUnit: 'm' },
    { key: 'height',    label: 'Wall height', kind: 'length', defaultUnit: 'm' },
    { key: 'thickness', label: 'Wall thickness', kind: 'thickness', defaultUnit: 'mm' },
  ],
  plaster: [
    { key: 'length',    label: 'Length', kind: 'length', defaultUnit: 'm' },
    { key: 'height',    label: 'Height', kind: 'length', defaultUnit: 'm' },
    { key: 'thickness', label: 'Plaster thickness', kind: 'thickness', defaultUnit: 'mm' },
  ],
  reinforcement: [
    { key: 'length', label: 'Bar length', kind: 'length', defaultUnit: 'm' },
  ],
  tiles: [
    { key: 'length', label: 'Length', kind: 'length', defaultUnit: 'm' },
    { key: 'width',  label: 'Width',  kind: 'length', defaultUnit: 'm' },
  ],
  paint: [
    { key: 'length', label: 'Length', kind: 'length', defaultUnit: 'm' },
    { key: 'width',  label: 'Width',  kind: 'length', defaultUnit: 'm' },
  ],
}

function initDims(calcType) {
  const fields = FIELD_CONFIG[calcType] || []
  return Object.fromEntries(fields.map(f => [f.key, DEFAULT_DIM(f.defaultUnit)]))
}

function DimensionInput({ label, dim, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: C.textDim, fontFamily: "'IBM Plex Mono'", marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
        <span style={{ color: C.textFaint, marginLeft: 6, textTransform: 'none', fontSize: 9 }}>→ m internal</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input
          type="number"
          min="0"
          step="any"
          placeholder="0"
          value={dim.value}
          onChange={e => onChange({ ...dim, value: e.target.value })}
          style={inputStyle}
        />
        <select
          value={dim.unit}
          onChange={e => onChange({ ...dim, unit: e.target.value })}
          style={unitSelectStyle}
          aria-label={`${label} unit`}
        >
          {UNIT_OPTIONS.map(u => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function CalcsPage({ onAIAssist, aiBusy }) {
  const [calcType, setCalcType] = useState('concrete')
  const [dims, setDims] = useState(() => initDims('concrete'))
  const [mix, setMix] = useState('1:2:4')
  const [rebarDia, setRebarDia] = useState('16')
  const [rebarCount, setRebarCount] = useState('')
  const [result, setResult] = useState(null)
  const [conversions, setConversions] = useState(null)
  const [errors, setErrors] = useState([])

  const switchType = useCallback((t) => {
    setCalcType(t)
    setDims(initDims(t))
    setResult(null)
    setConversions(null)
    setErrors([])
  }, [])

  const setDim = useCallback((key, patch) => {
    setDims(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }, [])

  const calc = () => {
    const fields = FIELD_CONFIG[calcType] || []
    const { converted, display, errors: errs, ok } = resolveDimensions(fields, dims)

    if (!ok) {
      setErrors(errs)
      setResult(null)
      setConversions(null)
      return
    }

    if (calcType === 'reinforcement') {
      const n = parseInt(rebarCount, 10)
      if (!n || n < 1) {
        setErrors(['Number of bars must be at least 1'])
        setResult(null)
        setConversions(null)
        return
      }
    }

    setErrors([])
    setConversions(display)

    const c = converted
    let out = null

    switch (calcType) {
      case 'concrete':
        out = calcConcrete(c.length, c.width, c.depth, mix)
        break
      case 'blocks':
        out = calcBlocks(c.length, c.height, c.thickness)
        break
      case 'plaster':
        out = calcPlaster(c.length, c.height, c.thickness)
        break
      case 'reinforcement':
        out = calcRebar(c.length, rebarDia, rebarCount)
        break
      case 'tiles':
        out = calcTiles(c.length, c.width)
        break
      case 'paint':
        out = calcPaint(c.length, c.width)
        break
      default:
        break
    }

    setResult(out)
  }

  const fields = FIELD_CONFIG[calcType] || []

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
      <div style={{ fontFamily: "'Bebas Neue'", fontSize: 25, letterSpacing: 2, color: C.amber, marginBottom: 3 }}>
        MATERIAL CALCULATORS
      </div>
      <div style={{ fontSize: 12.5, color: C.textDim, marginBottom: 16 }}>
        Enter dimensions in any unit — all quantities calculated in metric (metres) internally.
      </div>

      <div style={{ display: 'flex', gap: 7, marginBottom: 18, flexWrap: 'wrap' }}>
        {CALC_TYPES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => switchType(id)}
            style={{
              padding: '6px 14px',
              background: calcType === id ? C.amberGlow : C.panel,
              border: `1px solid ${calcType === id ? C.amber : C.border}`,
              borderRadius: 20,
              cursor: 'pointer',
              color: calcType === id ? C.amber : C.textDim,
              fontSize: 12,
              fontWeight: calcType === id ? 600 : 400,
              fontFamily: 'DM Sans',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
        gap: 14,
        alignItems: 'start',
      }}>
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 15, letterSpacing: 1, color: C.sky, marginBottom: 14 }}>
            {calcType.toUpperCase()} CALCULATOR
          </div>

          <div style={{ display: 'grid', gap: 12, marginBottom: 14 }}>
            {fields.map(f => (
              <DimensionInput
                key={f.key}
                label={f.label}
                dim={dims[f.key] || DEFAULT_DIM(f.defaultUnit)}
                onChange={patch => setDim(f.key, patch)}
              />
            ))}

            {calcType === 'concrete' && (
              <div>
                <div style={labelStyle}>Mix ratio</div>
                <select value={mix} onChange={e => setMix(e.target.value)} style={selectStyle}>
                  {Object.entries(MIX_RATIOS).map(([k, v]) => (
                    <option key={k} value={k}>{k} — {v.grade} ({v.cement})</option>
                  ))}
                </select>
              </div>
            )}

            {calcType === 'reinforcement' && (
              <>
                <div>
                  <div style={labelStyle}>Bar diameter (mm)</div>
                  <select value={rebarDia} onChange={e => setRebarDia(e.target.value)} style={selectStyle}>
                    {[8, 10, 12, 16, 20, 25].map(d => (
                      <option key={d} value={d}>Y{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={labelStyle}>Number of bars</div>
                  <input type="number" min="1" value={rebarCount} onChange={e => setRebarCount(e.target.value)} style={inputStyle} placeholder="e.g. 12" />
                </div>
              </>
            )}
          </div>

          {errors.length > 0 && (
            <div style={{ background: 'rgba(248,113,113,.07)', border: '1px solid rgba(248,113,113,.3)', borderRadius: 6, padding: '8px 10px', marginBottom: 12, fontSize: 12, color: C.red }}>
              {errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
            </div>
          )}

          <Button onClick={calc} style={{ width: '100%', justifyContent: 'center' }}>Calculate</Button>
        </div>

        {(conversions || result) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {conversions && (
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: 14, letterSpacing: 1, color: C.sky, marginBottom: 10 }}>
                  UNIT CONVERSIONS
                </div>
                {Object.entries(conversions).map(([key, d]) => (
                  <div key={key} style={{ background: C.slate, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', marginBottom: 6, fontSize: 11.5 }}>
                    <div style={{ color: C.textFaint, fontFamily: "'IBM Plex Mono'", fontSize: 9, textTransform: 'uppercase', marginBottom: 3 }}>{key}</div>
                    <div style={{ color: C.textDim }}>{d.label}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono'", color: C.green, fontSize: 12, marginTop: 2 }}>
                      Used in calc: {d.meters?.toFixed(4)} m
                    </div>
                  </div>
                ))}
              </div>
            )}

            {result && (
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: 15, letterSpacing: 1, color: C.amber, marginBottom: 12 }}>
                  RESULTS (metric)
                </div>
                {Object.entries(result).map(([k, v]) => (
                  <div key={k} style={{ background: C.slate, border: `1px solid ${C.border}`, borderRadius: 6, padding: '9px 12px', marginBottom: 7 }}>
                    <div style={{ fontSize: 11, color: C.textDim, marginBottom: 2 }}>{k}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 14, color: C.amber, fontWeight: 500 }}>{v}</div>
                  </div>
                ))}
                <Button
                  variant="sky"
                  size="sm"
                  disabled={aiBusy}
                  style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}
                  onClick={() => onAIAssist?.(`I ran a ${calcType} calculation. Conversions: ${JSON.stringify(conversions)}. Results: ${JSON.stringify(result)}. Review, add wastage, price at Accra market rates.`)}
                >
                  {aiBusy ? '⏳ AI working…' : '🤖 Send to AI for Pricing'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const labelStyle = {
  fontSize: 10,
  color: C.textDim,
  fontFamily: "'IBM Plex Mono'",
  marginBottom: 5,
  textTransform: 'uppercase',
}

const inputStyle = {
  flex: '1 1 120px',
  minWidth: 0,
  background: C.slate,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  color: C.text,
  fontFamily: "'IBM Plex Mono'",
  fontSize: 13,
  padding: '8px 10px',
  outline: 'none',
}

const unitSelectStyle = {
  flex: '0 0 72px',
  background: C.slate,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  color: C.amber,
  fontFamily: "'IBM Plex Mono'",
  fontSize: 12,
  padding: '8px 6px',
  outline: 'none',
  cursor: 'pointer',
}

const selectStyle = {
  background: C.slate,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  color: C.text,
  fontFamily: 'DM Sans',
  fontSize: 13,
  padding: '8px 10px',
  outline: 'none',
  width: '100%',
}
