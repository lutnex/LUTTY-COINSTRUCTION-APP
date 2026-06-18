import { useState, useCallback, useMemo } from 'react'
import { C } from '../../utils/constants.js'
import { Button } from '../shared/Button.jsx'
import {
  DEFAULT_DIM,
  resolveDimensions,
  CONVERTER_GROUPS,
  convertGeneral,
  UNIT_LABELS,
  toMeters,
  toM2,
  convertThicknessToMeters,
} from '../../utils/unitConversion.js'
import {
  calcBlockwork,
  calcMortarBlockwork,
  calcConcrete,
  calcPlaster,
  calcReinforcement,
  calcTiles,
  calcPaint,
  BLOCK_PRESETS,
  CONCRETE_MIX_PRESETS,
  PAINT_COVERAGE_PRESETS,
} from '../../utils/calcEngine.js'

const LENGTH_UNITS = ['mm', 'cm', 'm', 'inch', 'ft']

const CALC_TYPES = [
  { id: 'blockwork', label: 'Blockwork' },
  { id: 'mortar', label: 'Mortar' },
  { id: 'concrete', label: 'Concrete' },
  { id: 'plaster', label: 'Plaster' },
  { id: 'reinforcement', label: 'Reinforcement' },
  { id: 'tiles', label: 'Tiles' },
  { id: 'paint', label: 'Paint' },
  { id: 'converter', label: 'Unit Converter' },
]

function DimensionInput({ label, dim, onChange, units = LENGTH_UNITS, hint }) {
  return (
    <div>
      <div style={labelStyle}>
        {label}
        {hint && <span style={{ color: C.textFaint, marginLeft: 6, textTransform: 'none', fontSize: 9 }}>{hint}</span>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input type="number" min="0" step="any" placeholder="0" value={dim.value}
          onChange={e => onChange({ ...dim, value: e.target.value })} style={inputStyle} />
        <select value={dim.unit} onChange={e => onChange({ ...dim, unit: e.target.value })} style={unitSelectStyle}>
          {units.map(u => <option key={u} value={u}>{UNIT_LABELS[u] || u}</option>)}
        </select>
      </div>
    </div>
  )
}

function NumField({ label, value, onChange, step = 'any', min, hint, suffix }) {
  return (
    <div>
      <div style={labelStyle}>{label}{hint && <span style={{ color: C.textFaint, marginLeft: 6, fontSize: 9 }}>{hint}</span>}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="number" step={step} min={min} value={value} onChange={e => onChange(e.target.value)} style={inputStyle} />
        {suffix && <span style={{ fontSize: 11, color: C.textDim }}>{suffix}</span>}
      </div>
    </div>
  )
}

function CalcResultPanel({ result, conversions, onAIAssist, aiBusy, calcType }) {
  if (!result && !conversions) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {conversions && Object.keys(conversions).length > 0 && (
        <div style={panelStyle}>
          <div style={panelTitleStyle}>CONVERTED METRIC INPUTS</div>
          {Object.entries(conversions).map(([key, d]) => (
            <div key={key} style={rowStyle}>
              <div style={{ color: C.textFaint, fontFamily: "'IBM Plex Mono'", fontSize: 9, textTransform: 'uppercase' }}>{key}</div>
              <div style={{ color: C.textDim, fontSize: 11.5 }}>{d.label}</div>
            </div>
          ))}
        </div>
      )}

      {result?.ok === false && (
        <div style={{ ...panelStyle, borderColor: C.red, color: C.red, fontSize: 12 }}>{result.error}</div>
      )}

      {result?.ok && (
        <>
          <div style={panelStyle}>
            <div style={{ ...panelTitleStyle, color: C.amber }}>{result.title?.toUpperCase()} — RESULTS</div>
            <div style={{ background: C.slate, borderRadius: 6, padding: '10px 12px', marginBottom: 10, fontSize: 11.5, color: C.sky, lineHeight: 1.5 }}>
              <strong style={{ color: C.amber }}>Formula:</strong> {result.formula}
            </div>
            {result.assumptions?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: C.textFaint, fontFamily: "'IBM Plex Mono'", marginBottom: 4 }}>ASSUMPTIONS</div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: C.textDim, lineHeight: 1.55 }}>
                  {result.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}
            {result.steps?.map((s, i) => (
              <div key={i} style={rowStyle}>
                <div style={{ fontSize: 11, color: C.textDim }}>{s.label}</div>
                <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 14, color: C.amber, fontWeight: 500 }}>{s.value}</div>
                {s.detail && <div style={{ fontSize: 10, color: C.textFaint, marginTop: 2 }}>{s.detail}</div>}
              </div>
            ))}
          </div>

          {result.sections?.purchase && (
            <div style={{ ...panelStyle, borderColor: `${C.green}55` }}>
              <div style={{ ...panelTitleStyle, color: C.green }}>PURCHASE RECOMMENDATION</div>
              {Object.entries(result.sections.purchase).map(([k, v]) => v != null && (
                <div key={k} style={rowStyle}>
                  <div style={{ fontSize: 11, color: C.textDim, textTransform: 'capitalize' }}>{k.replace(/([A-Z])/g, ' $1')}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 15, color: C.green, fontWeight: 600 }}>{v}</div>
                </div>
              ))}
              <div style={{ fontSize: 10, color: C.textFaint, marginTop: 8 }}>Quantities rounded up for ordering. No prices included.</div>
            </div>
          )}

          {onAIAssist && calcType !== 'converter' && (
            <Button variant="sky" size="sm" disabled={aiBusy} style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => onAIAssist?.(`QS ${calcType} calculation:\nFormula: ${result.formula}\nSteps: ${JSON.stringify(result.steps)}\nPurchase: ${JSON.stringify(result.sections?.purchase)}. Price at user-entered rates only — do not invent prices.`)}
            >
              {aiBusy ? '⏳ AI working…' : '🤖 Send to AI for Pricing'}
            </Button>
          )}
        </>
      )}
    </div>
  )
}

export function CalcsPage({ onAIAssist, aiBusy }) {
  const [calcType, setCalcType] = useState('blockwork')
  const [dims, setDims] = useState(() => initDims('blockwork'))
  const [nums, setNums] = useState(() => initNums('blockwork'))
  const [result, setResult] = useState(null)
  const [conversions, setConversions] = useState(null)
  const [errors, setErrors] = useState([])

  const [convType, setConvType] = useState('length')
  const [convFrom, setConvFrom] = useState('ft')
  const [convTo, setConvTo] = useState('m')
  const [convValue, setConvValue] = useState('')

  const switchType = useCallback((t) => {
    setCalcType(t)
    setDims(initDims(t))
    setNums(initNums(t))
    setResult(null)
    setConversions(null)
    setErrors([])
  }, [])

  const setDim = useCallback((key, patch) => {
    setDims(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }, [])

  const setNum = useCallback((key, val) => {
    setNums(prev => ({ ...prev, [key]: val }))
  }, [])

  const blockPreset = useMemo(() => BLOCK_PRESETS[nums.blockPreset] || BLOCK_PRESETS.ghana_450x225, [nums.blockPreset])

  const runCalc = () => {
    if (calcType === 'converter') {
      const r = convertGeneral(convType, convValue, convFrom, convTo)
      setErrors(r.ok ? [] : [r.error])
      setConversions(null)
      setResult(r.ok ? {
        ok: true,
        title: 'Unit Converter',
        formula: `${convType} conversion`,
        assumptions: ['All conversions use standard metric/imperial factors.'],
        steps: [{ label: 'Result', value: `${r.result} ${UNIT_LABELS[convTo] || convTo}`, detail: r.formula }],
        sections: {},
      } : r)
      return
    }

    const fields = FIELD_CONFIG[calcType] || []
    const { converted, display, errors: errs, ok } = resolveDimensions(fields, dims)
    if (!ok) {
      setErrors(errs)
      setResult(null)
      setConversions(null)
      return
    }
    setErrors([])
    setConversions(display)

    const c = converted
    const n = nums
    const wastage = parseFloat(n.wastage) || 0
    const openings = n.openingsArea ? toM2(parseFloat(n.openingsArea), n.openingsUnit || 'm2') : 0

    let out = null

    switch (calcType) {
      case 'blockwork':
        out = calcBlockwork({
          wallLengthM: c.length,
          wallHeightM: c.height,
          blockFaceLengthM: n.blockPreset === 'custom'
            ? toMeters(n.blockFaceL, n.blockFaceLUnit || 'mm')
            : blockPreset.faceLengthM,
          blockFaceHeightM: n.blockPreset === 'custom'
            ? toMeters(n.blockFaceH, n.blockFaceHUnit || 'mm')
            : blockPreset.faceHeightM,
          openingsAreaM2: openings,
          wastagePct: wastage,
          mortarJointAllowanceM: n.jointAllowance ? toMeters(n.jointAllowance, n.jointUnit || 'mm') : 0,
        })
        break
      case 'mortar': {
        const netArea = c.length * c.height - openings
        const bw = calcBlockwork({
          wallLengthM: c.length,
          wallHeightM: c.height,
          blockFaceLengthM: blockPreset.faceLengthM,
          blockFaceHeightM: blockPreset.faceHeightM,
          openingsAreaM2: openings,
          wastagePct: 0,
        })
        const baseBlocks = bw.ok ? bw.steps.find(s => s.label.includes('Base blocks'))?.value : 0
        out = calcMortarBlockwork({
          netWallAreaM2: netArea,
          wallThicknessM: c.thickness,
          blockFaceLengthM: blockPreset.faceLengthM,
          blockFaceHeightM: blockPreset.faceHeightM,
          blockThicknessM: toMeters(n.blockThickness || '150', 'mm'),
          baseBlockCount: baseBlocks,
          mode: n.mortarMode || 'standard',
          mortarPerM2: parseFloat(n.mortarPerM2) || 0.018,
          mixRatio: { cement: 1, sand: parseFloat(n.sandRatio) || 6 },
          sandTripM3: parseFloat(n.sandTrip) || 0,
        })
        break
      }
      case 'concrete':
        out = calcConcrete({
          lengthM: c.length,
          widthM: c.width,
          depthM: c.depth,
          mixKey: n.mix || '1:2:4',
          wastagePct: wastage,
          aggregateTripM3: parseFloat(n.aggTrip) || 0,
        })
        break
      case 'plaster':
        out = calcPlaster({
          wallLengthM: c.length,
          wallHeightM: c.height,
          sides: parseInt(n.sides, 10) || 1,
          openingsAreaM2: openings,
          thicknessM: convertThicknessToMeters(n.thickness || '12', n.thicknessUnit || 'mm'),
          mixRatio: { cement: 1, sand: parseFloat(n.sandRatio) || 4 },
          wastagePct: wastage,
        })
        break
      case 'reinforcement':
        out = calcReinforcement({
          barDiameterMm: n.barDia || '12',
          barLengthM: c.length,
          barCount: n.barCount,
          spacingMm: parseFloat(n.spacing) || 0,
          memberLengthM: c.memberLength,
          lapAllowanceM: parseFloat(n.lap) || 0,
          wastagePct: wastage,
        })
        break
      case 'tiles':
        out = calcTiles({
          lengthM: c.length,
          widthM: c.width,
          manualAreaM2: n.useManualArea ? toM2(parseFloat(n.manualArea), n.manualAreaUnit || 'm2') : 0,
          tileLengthM: toMeters(n.tileL, n.tileUnit || 'mm'),
          tileWidthM: toMeters(n.tileW, n.tileUnit || 'mm'),
          openingsAreaM2: openings,
          wastagePct: wastage,
          piecesPerBox: parseInt(n.piecesPerBox, 10) || 5,
          boxCoverageM2: parseFloat(n.boxCoverage) || 0,
        })
        break
      case 'paint':
        out = calcPaint({
          wallLengthM: c.length,
          wallHeightM: c.height,
          manualAreaM2: n.useManualArea ? toM2(parseFloat(n.manualArea), n.manualAreaUnit || 'm2') : 0,
          coats: parseInt(n.coats, 10) || 2,
          openingsAreaM2: openings,
          coverageM2PerLitre: parseFloat(n.coverage) || PAINT_COVERAGE_PRESETS.emulsion.coverage,
          bucketLitres: parseFloat(n.bucketSize) || 5,
          wastagePct: wastage,
        })
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
        QS MATERIAL CALCULATORS
      </div>
      <div style={{ fontSize: 12.5, color: C.textDim, marginBottom: 16 }}>
        Industry-standard quantity takeoff — formulas shown, wastage user-controlled, metric internal. No invented prices.
      </div>

      <div style={{ display: 'flex', gap: 7, marginBottom: 18, flexWrap: 'wrap' }}>
        {CALC_TYPES.map(({ id, label }) => (
          <button key={id} type="button" onClick={() => switchType(id)} style={tabStyle(calcType === id)}>{label}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 14, alignItems: 'start' }}>
        <div style={panelStyle}>
          <div style={panelTitleStyle}>{calcType.toUpperCase()} — INPUTS</div>

          {calcType === 'converter' ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <div style={labelStyle}>Conversion type</div>
                <select value={convType} onChange={e => { setConvType(e.target.value); const g = CONVERTER_GROUPS[e.target.value]; setConvFrom(g.defaultFrom); setConvTo(g.defaultTo) }} style={selectStyle}>
                  {Object.keys(CONVERTER_GROUPS).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <NumField label="Value" value={convValue} onChange={setConvValue} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={labelStyle}>From</div>
                  <select value={convFrom} onChange={e => setConvFrom(e.target.value)} style={selectStyle}>
                    {CONVERTER_GROUPS[convType].units.map(u => <option key={u} value={u}>{UNIT_LABELS[u] || u}</option>)}
                  </select>
                </div>
                <div>
                  <div style={labelStyle}>To</div>
                  <select value={convTo} onChange={e => setConvTo(e.target.value)} style={selectStyle}>
                    {CONVERTER_GROUPS[convType].units.map(u => <option key={u} value={u}>{UNIT_LABELS[u] || u}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12, marginBottom: 14 }}>
              {fields.map(f => (
                <DimensionInput key={f.key} label={f.label} dim={dims[f.key] || DEFAULT_DIM(f.defaultUnit)}
                  onChange={patch => setDim(f.key, patch)} units={f.units || LENGTH_UNITS} hint={f.hint} />
              ))}

              {(calcType === 'blockwork' || calcType === 'mortar') && (
                <>
                  <div>
                    <div style={labelStyle}>Block preset</div>
                    <select value={nums.blockPreset} onChange={e => setNum('blockPreset', e.target.value)} style={selectStyle}>
                      {Object.entries(BLOCK_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      <option value="custom">Custom face size</option>
                    </select>
                  </div>
                  {nums.blockPreset === 'custom' && (
                    <>
                      <DimensionInput label="Block face length" dim={{ value: nums.blockFaceL, unit: nums.blockFaceLUnit || 'mm' }}
                        onChange={p => { setNum('blockFaceL', p.value); setNum('blockFaceLUnit', p.unit) }} units={['mm', 'cm', 'm', 'inch']} />
                      <DimensionInput label="Block face height" dim={{ value: nums.blockFaceH, unit: nums.blockFaceHUnit || 'mm' }}
                        onChange={p => { setNum('blockFaceH', p.value); setNum('blockFaceHUnit', p.unit) }} units={['mm', 'cm', 'm', 'inch']} />
                    </>
                  )}
                  {calcType === 'mortar' && (
                    <>
                      <div>
                        <div style={labelStyle}>Mortar calculation mode</div>
                        <select value={nums.mortarMode} onChange={e => setNum('mortarMode', e.target.value)} style={selectStyle}>
                          <option value="standard">A — Standard QS (m³/m²)</option>
                          <option value="detailed">B — Detailed (wall vol − block vol)</option>
                        </select>
                      </div>
                      <NumField label="Mortar per m² (standard mode)" value={nums.mortarPerM2} onChange={v => setNum('mortarPerM2', v)} hint="default 0.018" />
                      <NumField label="Sand ratio (1:X cement:sand)" value={nums.sandRatio} onChange={v => setNum('sandRatio', v)} hint="default 6" />
                      <NumField label="Sand trip volume (m³, optional)" value={nums.sandTrip} onChange={v => setNum('sandTrip', v)} />
                    </>
                  )}
                </>
              )}

              {calcType === 'concrete' && (
                <div>
                  <div style={labelStyle}>Mix ratio</div>
                  <select value={nums.mix} onChange={e => setNum('mix', e.target.value)} style={selectStyle}>
                    {Object.entries(CONCRETE_MIX_PRESETS).map(([k, v]) => (
                      <option key={k} value={k}>{k} — {v.grade} ({v.cementGrade})</option>
                    ))}
                  </select>
                </div>
              )}

              {calcType === 'plaster' && (
                <>
                  <NumField label="Sides (1 or 2)" value={nums.sides} onChange={v => setNum('sides', v)} min="1" />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <NumField label="Thickness" value={nums.thickness} onChange={v => setNum('thickness', v)} suffix={nums.thicknessUnit || 'mm'} />
                    <select value={nums.thicknessUnit || 'mm'} onChange={e => setNum('thicknessUnit', e.target.value)} style={{ ...unitSelectStyle, alignSelf: 'flex-end' }}>
                      <option value="mm">mm</option>
                      <option value="inch">in</option>
                    </select>
                  </div>
                  <NumField label="Sand ratio (1:X)" value={nums.sandRatio} onChange={v => setNum('sandRatio', v)} hint="default 4" />
                </>
              )}

              {calcType === 'reinforcement' && (
                <>
                  <div>
                    <div style={labelStyle}>Bar diameter</div>
                    <select value={nums.barDia} onChange={e => setNum('barDia', e.target.value)} style={selectStyle}>
                      {[6, 8, 10, 12, 16, 20, 25].map(d => <option key={d} value={d}>Y{d} — {(d * d / 162).toFixed(3)} kg/m</option>)}
                    </select>
                  </div>
                  <NumField label="Number of bars" value={nums.barCount} onChange={v => setNum('barCount', v)} hint="or use spacing below" />
                  <NumField label="Spacing (mm, optional)" value={nums.spacing} onChange={v => setNum('spacing', v)} />
                  {parseFloat(nums.spacing) > 0 && (
                    <DimensionInput label="Member length (for spacing count)" dim={dims.memberLength || DEFAULT_DIM('m')}
                      onChange={p => setDim('memberLength', p)} />
                  )}
                  <NumField label="Lap allowance per bar (m)" value={nums.lap} onChange={v => setNum('lap', v)} hint="default 0" />
                </>
              )}

              {calcType === 'tiles' && (
                <>
                  <label style={{ fontSize: 11, color: C.textDim, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="checkbox" checked={nums.useManualArea} onChange={e => setNum('useManualArea', e.target.checked)} />
                    Enter area directly
                  </label>
                  {nums.useManualArea ? (
                    <DimensionInput label="Area" dim={{ value: nums.manualArea, unit: nums.manualAreaUnit || 'm2' }}
                      onChange={p => { setNum('manualArea', p.value); setNum('manualAreaUnit', p.unit) }}
                      units={['m2', 'ft2']} hint="→ m²" />
                  ) : null}
                  <DimensionInput label="Tile length" dim={{ value: nums.tileL, unit: nums.tileUnit || 'mm' }}
                    onChange={p => { setNum('tileL', p.value); setNum('tileUnit', p.unit) }} units={['mm', 'cm', 'inch']} />
                  <DimensionInput label="Tile width" dim={{ value: nums.tileW, unit: nums.tileUnit || 'mm' }}
                    onChange={p => { setNum('tileW', p.value); setNum('tileUnit', p.unit) }} units={['mm', 'cm', 'inch']} />
                  <NumField label="Pieces per box" value={nums.piecesPerBox} onChange={v => setNum('piecesPerBox', v)} hint="default 5" />
                  <NumField label="Box coverage m² (optional)" value={nums.boxCoverage} onChange={v => setNum('boxCoverage', v)} />
                </>
              )}

              {calcType === 'paint' && (
                <>
                  <div>
                    <div style={labelStyle}>Paint type / coverage</div>
                    <select value={nums.paintPreset} onChange={e => {
                      setNum('paintPreset', e.target.value)
                      const p = PAINT_COVERAGE_PRESETS[e.target.value]
                      if (p) setNum('coverage', String(p.coverage))
                    }} style={selectStyle}>
                      {Object.entries(PAINT_COVERAGE_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <NumField label="Coverage (m²/litre/coat)" value={nums.coverage} onChange={v => setNum('coverage', v)} />
                  <NumField label="Number of coats" value={nums.coats} onChange={v => setNum('coats', v)} min="1" />
                  <NumField label="Bucket size (litres)" value={nums.bucketSize} onChange={v => setNum('bucketSize', v)} hint="default 5" />
                </>
              )}

              {['blockwork', 'plaster', 'tiles', 'paint', 'mortar'].includes(calcType) && (
                <div>
                  <div style={labelStyle}>Openings deduction (doors/windows)</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="number" min="0" value={nums.openingsArea} onChange={e => setNum('openingsArea', e.target.value)} style={inputStyle} placeholder="0" />
                    <select value={nums.openingsUnit || 'm2'} onChange={e => setNum('openingsUnit', e.target.value)} style={unitSelectStyle}>
                      <option value="m2">m²</option>
                      <option value="ft2">ft²</option>
                    </select>
                  </div>
                </div>
              )}

              {calcType !== 'converter' && (
                <NumField label="Wastage %" value={nums.wastage} onChange={v => setNum('wastage', v)} hint="editable" suffix="%" />
              )}
            </div>
          )}

          {errors.length > 0 && (
            <div style={{ background: 'rgba(248,113,113,.07)', border: '1px solid rgba(248,113,113,.3)', borderRadius: 6, padding: '8px 10px', marginBottom: 12, fontSize: 12, color: C.red }}>
              {errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
            </div>
          )}

          <Button onClick={runCalc} style={{ width: '100%', justifyContent: 'center' }}>Calculate</Button>
        </div>

        <CalcResultPanel result={result} conversions={conversions} onAIAssist={onAIAssist} aiBusy={aiBusy} calcType={calcType} />
      </div>
    </div>
  )
}

const FIELD_CONFIG = {
  blockwork: [
    { key: 'length', label: 'Wall length', defaultUnit: 'ft' },
    { key: 'height', label: 'Wall height', defaultUnit: 'ft' },
  ],
  mortar: [
    { key: 'length', label: 'Wall length', defaultUnit: 'm' },
    { key: 'height', label: 'Wall height', defaultUnit: 'm' },
    { key: 'thickness', label: 'Wall thickness', kind: 'thickness', defaultUnit: 'mm' },
  ],
  concrete: [
    { key: 'length', label: 'Length', defaultUnit: 'm' },
    { key: 'width', label: 'Width', defaultUnit: 'm' },
    { key: 'depth', label: 'Depth / thickness', kind: 'thickness', defaultUnit: 'm' },
  ],
  plaster: [
    { key: 'length', label: 'Wall length', defaultUnit: 'm' },
    { key: 'height', label: 'Wall height', defaultUnit: 'm' },
  ],
  reinforcement: [
    { key: 'length', label: 'Bar length', defaultUnit: 'm' },
  ],
  tiles: [
    { key: 'length', label: 'Room length', defaultUnit: 'm' },
    { key: 'width', label: 'Room width', defaultUnit: 'm' },
  ],
  paint: [
    { key: 'length', label: 'Wall length', defaultUnit: 'm' },
    { key: 'height', label: 'Wall height', defaultUnit: 'm' },
  ],
}

function initDims(type) {
  const fields = FIELD_CONFIG[type] || []
  return Object.fromEntries(fields.map(f => [f.key, DEFAULT_DIM(f.defaultUnit)]))
}

function initNums(type) {
  const base = {
    wastage: '10',
    openingsArea: '',
    openingsUnit: 'm2',
    blockPreset: 'us_8x16',
    mortarMode: 'standard',
    mortarPerM2: '0.018',
    sandRatio: '6',
    sandTrip: '',
    mix: '1:2:4',
    aggTrip: '',
    sides: '1',
    thickness: '12',
    thicknessUnit: 'mm',
    barDia: '12',
    barCount: '',
    spacing: '',
    lap: '0',
    tileL: '450',
    tileW: '450',
    tileUnit: 'mm',
    piecesPerBox: '5',
    boxCoverage: '',
    useManualArea: false,
    manualArea: '',
    manualAreaUnit: 'm2',
    paintPreset: 'emulsion',
    coverage: String(PAINT_COVERAGE_PRESETS.emulsion.coverage),
    coats: '2',
    bucketSize: '5',
    blockThickness: '150',
    jointAllowance: '',
    jointUnit: 'mm',
  }
  if (type === 'concrete') base.wastage = '5'
  if (type === 'plaster') base.wastage = '10'
  if (type === 'tiles') base.wastage = '10'
  if (type === 'paint') base.wastage = '10'
  if (type === 'reinforcement') base.wastage = '5'
  return base
}

function tabStyle(active) {
  return {
    padding: '6px 14px',
    background: active ? C.amberGlow : C.panel,
    border: `1px solid ${active ? C.amber : C.border}`,
    borderRadius: 20,
    cursor: 'pointer',
    color: active ? C.amber : C.textDim,
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    fontFamily: 'DM Sans',
  }
}

const panelStyle = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }
const panelTitleStyle = { fontFamily: "'Bebas Neue'", fontSize: 14, letterSpacing: 1, color: C.sky, marginBottom: 12 }
const rowStyle = { background: C.slate, border: `1px solid ${C.border}`, borderRadius: 6, padding: '9px 12px', marginBottom: 7 }
const labelStyle = { fontSize: 10, color: C.textDim, fontFamily: "'IBM Plex Mono'", marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }
const inputStyle = { flex: '1 1 120px', minWidth: 0, background: C.slate, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontFamily: "'IBM Plex Mono'", fontSize: 13, padding: '8px 10px', outline: 'none' }
const unitSelectStyle = { flex: '0 0 72px', background: C.slate, border: `1px solid ${C.border}`, borderRadius: 6, color: C.amber, fontFamily: "'IBM Plex Mono'", fontSize: 12, padding: '8px 6px', outline: 'none', cursor: 'pointer' }
const selectStyle = { background: C.slate, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontFamily: 'DM Sans', fontSize: 13, padding: '8px 10px', outline: 'none', width: '100%' }

export default CalcsPage
