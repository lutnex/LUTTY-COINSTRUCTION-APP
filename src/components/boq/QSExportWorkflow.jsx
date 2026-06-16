import { useMemo, useState, useEffect } from 'react'
import { C } from '../../utils/constants.js'
import {
  PRESENTATION_STYLES,
  buildClarificationPacket,
  identifyMissingMaterialPrices,
  validatePreExport,
  applyPriceInputsToRows,
  buildPriceConflicts,
  applyConflictChoices,
} from '../../utils/qsWorkflow.js'
import { PRICING_SOURCE_MODES, PRICING_SOURCE_OPTIONS } from '../../utils/priceProfileTypes.js'
import PriceCompareDialog from '../pricing/PriceCompareDialog.jsx'

const STEPS = ['clarification', 'pricing_source', 'prices', 'style', 'review']

export default function QSExportWorkflow({
  open,
  onClose,
  data,
  savedPrices = [],
  onSavePrices,
  onExport,
  title = 'QS Export Workflow',
  initialStep = 0,
  initialStyle = null,
  profileName = 'Default Profile',
  livePrices = [],
  autoOpenCompare = false,
}) {
  const [step, setStep] = useState(initialStep)
  const [presentationStyle, setPresentationStyle] = useState(initialStyle)
  const [pricingMode, setPricingMode] = useState(null)
  const [priceInputs, setPriceInputs] = useState([])
  const [assumptions, setAssumptions] = useState([])
  const [exclusions, setExclusions] = useState([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [resolvedRows, setResolvedRows] = useState(null)

  useEffect(() => {
    if (!open) return
    setStep(initialStep)
    setPresentationStyle(initialStyle)
    setPricingMode(data?.pricingConfig?.sourceMode || null)
    setPriceInputs([])
    setResolvedRows(null)
    setCompareOpen(false)
    setAssumptions(data?.assumptions || [])
    setExclusions(data?.exclusions || [])
  }, [open, data, initialStep, initialStyle])

  useEffect(() => {
    if (!open || !autoOpenCompare) return
    setStep(1)
    setPricingMode(PRICING_SOURCE_MODES.COMPARE)
  }, [open, autoOpenCompare])

  const rawRows = resolvedRows || data?.boqItems || data?.boqRows || []
  const rows = Array.isArray(rawRows) ? rawRows : []
  const packet = useMemo(() => buildClarificationPacket({ ...data, assumptions, exclusions, boqItems: rows }), [data, assumptions, exclusions, rows])

  const initialPrices = useMemo(() => {
    if (priceInputs.length) return priceInputs
    return identifyMissingMaterialPrices(rows, savedPrices, undefined, {
      pricingMode: pricingMode || PRICING_SOURCE_MODES.PROFILE,
      livePrices,
      profileName,
    })
  }, [rows, savedPrices, priceInputs, pricingMode, livePrices, profileName])

  const priceConflicts = useMemo(() => buildPriceConflicts(rows, { savedPrices, livePrices }), [rows, savedPrices, livePrices])

  useEffect(() => {
    if (!open || !autoOpenCompare || pricingMode !== PRICING_SOURCE_MODES.COMPARE) return
    if (priceConflicts.length) setCompareOpen(true)
  }, [open, autoOpenCompare, pricingMode, priceConflicts.length])

  const review = useMemo(() => validatePreExport({
    ...data,
    assumptions,
    exclusions,
    boqItems: applyPriceInputsToRows(rows, initialPrices),
  }, { presentationStyle }), [data, assumptions, exclusions, rows, initialPrices, presentationStyle])

  if (!open) return null

  const updatePrice = (id, field, value) => {
    setPriceInputs(prev => {
      const base = prev.length ? prev : initialPrices
      return base.map(p => p.id === id ? { ...p, [field]: value, priceSource: 'user', status: 'confirmed' } : p)
    })
  }

  const handleExport = () => {
    if (!review.ok) return
    const updatedRows = applyPriceInputsToRows(rows, priceInputs.length ? priceInputs : initialPrices, { profileName })
    onExport?.({
      presentationStyle,
      pricingMode,
      priceInputs: priceInputs.length ? priceInputs : initialPrices,
      rows: updatedRows,
      assumptions,
      exclusions,
      workflowMeta: { reviewedAt: new Date().toISOString(), review, profileName, pricingMode },
    })
    if (onSavePrices) onSavePrices(priceInputs.length ? priceInputs : initialPrices)
    onClose?.()
  }

  const handlePricingMode = (mode) => {
    setPricingMode(mode)
    setPriceInputs([])
    if (mode === PRICING_SOURCE_MODES.COMPARE && priceConflicts.length) {
      setCompareOpen(true)
    } else {
      setStep(2)
    }
  }

  const handleCompareResolve = (resolved) => {
    const updated = applyConflictChoices(rows, resolved)
    setResolvedRows(updated)
    setCompareOpen(false)
    setStep(2)
  }

  const panel = {
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: 20,
    maxWidth: 920,
    width: '95vw',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,.55)',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 24, color: C.amber, letterSpacing: 2 }}>{title}</div>
            <div style={{ fontSize: 12, color: C.textDim }}>Professional QS review — no export until approved</div>
          </div>
          <button onClick={onClose} style={ghostBtn()}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 11, fontFamily: "'IBM Plex Mono'",
              background: i === step ? C.amberGlow : C.slate,
              border: `1px solid ${i === step ? C.amber : C.border}`,
              color: i <= step ? C.amber : C.textFaint,
            }}>
              {i + 1}. {s}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div>
            <Section title="Measured quantities" count={packet.measuredQuantities.length} />
            <MiniTable rows={packet.measuredQuantities.slice(0, 12)} cols={['desc', 'unit', 'qty']} />
            {packet.measuredQuantities.length > 12 && <Note>+ {packet.measuredQuantities.length - 12} more lines in full BOQ</Note>}

            <Section title="Items requiring user prices" count={packet.itemsRequiringPrices.length} warn />
            <PriceHintList items={packet.itemsRequiringPrices} />

            <Section title="Assumptions (editable)" count={assumptions.length} />
            <EditableList items={assumptions} onChange={setAssumptions} />

            <Section title="Exclusions (editable)" count={exclusions.length} />
            <EditableList items={exclusions} onChange={setExclusions} />

            <Section title="Provisional items" count={packet.provisionalItems.length} />
            <BulletList items={packet.provisionalItems} />

            <Section title="Client-supplied items" count={packet.clientSuppliedItems.length} />
            <MiniTable rows={packet.clientSuppliedItems} cols={['desc', 'unit', 'qty']} />
          </div>
        )}

        {step === 1 && (
          <div>
            <Note>Before applying any rates, choose your pricing source. The AI will not silently select rates.</Note>
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {PRICING_SOURCE_OPTIONS.map(opt => (
                <button key={opt.id} type="button" onClick={() => handlePricingMode(opt.id)} style={{
                  textAlign: 'left', padding: 14, borderRadius: 10, cursor: 'pointer',
                  background: pricingMode === opt.id ? C.amberGlow : C.slate,
                  border: `2px solid ${pricingMode === opt.id ? C.amber : C.border}`,
                  color: C.text, fontFamily: 'DM Sans',
                }}>
                  <div style={{ fontWeight: 700, color: C.amber, marginBottom: 4 }}>{opt.label}</div>
                  <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5 }}>{opt.desc}</div>
                </button>
              ))}
            </div>
            {pricingMode === PRICING_SOURCE_MODES.COMPARE && priceConflicts.length > 0 && (
              <button type="button" onClick={() => setCompareOpen(true)} style={{ ...primaryBtn(), marginTop: 12 }}>
                Compare Profile vs Market ({priceConflicts.length} conflicts)
              </button>
            )}
            <Note>Active profile: {profileName}</Note>
          </div>
        )}

        {step === 2 && (
          <div>
            <Note>
              Pricing source: {PRICING_SOURCE_OPTIONS.find(o => o.id === pricingMode)?.label || 'Not selected'}.
              Enter unit prices for each material. Saved profile values are suggested — edit before confirming.
            </Note>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle()}>
                <thead>
                  <tr>
                    {['Material', 'Specification', 'Unit', 'Unit Price (GHS)', 'Supplier', 'Supply Type'].map(h => (
                      <th key={h} style={thStyle()}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(priceInputs.length ? priceInputs : initialPrices).map(p => (
                    <tr key={p.id}>
                      <td style={tdStyle()}>{p.material}</td>
                      <td style={tdStyle()}><input value={p.specification} onChange={e => updatePrice(p.id, 'specification', e.target.value)} style={inputStyle()} /></td>
                      <td style={tdStyle()}><input value={p.unit} onChange={e => updatePrice(p.id, 'unit', e.target.value)} style={inputStyle(60)} /></td>
                      <td style={tdStyle()}>
                        <input value={p.unitPrice} onChange={e => updatePrice(p.id, 'unitPrice', e.target.value)} placeholder={p.marketStatus === 'manual_entry_required' ? 'Manual entry required' : '0.00'} style={inputStyle(90)} />
                      </td>
                      <td style={tdStyle()}><input value={p.supplier || ''} onChange={e => updatePrice(p.id, 'supplier', e.target.value)} style={inputStyle()} /></td>
                      <td style={tdStyle()}>
                        <select value={p.supplyType} onChange={e => updatePrice(p.id, 'supplyType', e.target.value)} style={inputStyle(140)}>
                          {['contractor-supplied', 'client-supplied', 'optional', 'provisional', 'excluded'].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!initialPrices.length && <Note>No pending material prices — proceed to document style selection.</Note>}
          </div>
        )}

        {step === 3 && (
          <div>
            <Note>Choose document presentation style before sending to Document Generator:</Note>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <StyleCard
                selected={presentationStyle === PRESENTATION_STYLES.PREMIUM}
                title="A. Premium Quotation"
                desc="Summarized category totals with clean client-facing presentation. Hides excessive technical line items."
                onClick={() => setPresentationStyle(PRESENTATION_STYLES.PREMIUM)}
              />
              <StyleCard
                selected={presentationStyle === PRESENTATION_STYLES.DETAILED}
                title="B. Detailed BOQ"
                desc="Full item-by-item breakdown with specifications, quantities, unit rates, assumptions, exclusions, and notes."
                onClick={() => setPresentationStyle(PRESENTATION_STYLES.DETAILED)}
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <ReviewRow label="BOQ lines" value={rows.length} />
            <ReviewRow label="Missing prices" value={review.missingPrices.length} warn={review.missingPrices.length > 0} />
            <ReviewRow label="Assumptions" value={assumptions.length} warn={assumptions.length > 5} />
            {assumptions.length > 0 && <BulletList items={assumptions.slice(0, 6)} />}
            <ReviewRow label="Provisional items" value={review.provisionalItems.length} />
            <ReviewRow label="Optional items" value={review.optionalItems.length} />
            <ReviewRow label="High-risk assumptions" value={review.highRiskAssumptions.length} warn={review.highRiskAssumptions.length > 0} />
            <ReviewRow label="Pricing source" value={pricingMode ? PRICING_SOURCE_OPTIONS.find(o => o.id === pricingMode)?.label?.slice(0, 30) : 'Not selected'} warn={!pricingMode} />
            <ReviewRow label="Document style" value={presentationStyle === PRESENTATION_STYLES.PREMIUM ? 'Premium Quotation' : presentationStyle === PRESENTATION_STYLES.DETAILED ? 'Detailed BOQ' : 'Not selected'} warn={!presentationStyle} />
            <ReviewRow label="Final total (GHS)" value={Number(review.finalTotal || 0).toLocaleString('en', { minimumFractionDigits: 2 })} highlight />
            {review.blockers.map(b => <Note key={b} warn>⛔ {b}</Note>)}
            {review.warnings.map(w => <Note key={w}>⚠ {w}</Note>)}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, gap: 8 }}>
          <button onClick={() => step > 0 ? setStep(step - 1) : onClose()} style={ghostBtn()}>{step === 0 ? 'Cancel' : '← Back'}</button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => {
              if (step === 1 && !pricingMode) return
              setStep(step + 1)
            }} disabled={step === 1 && !pricingMode} style={{ ...primaryBtn(), opacity: step === 1 && !pricingMode ? 0.5 : 1 }}>Continue →</button>
          ) : (
            <>
              <button type="button" onClick={onClose} style={ghostBtn()}>Approve Review</button>
              <button onClick={handleExport} disabled={!review.ok} style={{ ...primaryBtn(), opacity: review.ok ? 1 : 0.5, cursor: review.ok ? 'pointer' : 'not-allowed' }}>
                Approve and Export to Document Generator
              </button>
            </>
          )}
        </div>
      </div>

      <PriceCompareDialog
        open={compareOpen}
        conflicts={priceConflicts}
        onResolve={handleCompareResolve}
        onCancel={() => setCompareOpen(false)}
      />
    </div>
  )
}

function Section({ title, count, warn }) {
  return <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: warn ? C.red : C.amber, margin: '14px 0 6px', letterSpacing: 1 }}>{title} ({count})</div>
}

function Note({ children, warn }) {
  return <div style={{ fontSize: 12, color: warn ? C.red : C.textDim, marginBottom: 8, lineHeight: 1.5 }}>{children}</div>
}

function BulletList({ items }) {
  if (!items?.length) return <Note>None listed</Note>
  return <ul style={{ margin: '0 0 10px 18px', color: C.text, fontSize: 12.5 }}>{items.map((it, i) => <li key={i}>{String(it)}</li>)}</ul>
}

function EditableList({ items, onChange }) {
  const list = items?.length ? items : ['']
  return (
    <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
      {list.map((item, i) => (
        <input key={i} value={item} onChange={e => {
          const next = [...list]
          next[i] = e.target.value
          onChange(next.filter(Boolean))
        }} style={inputStyle()} />
      ))}
      <button onClick={() => onChange([...list, ''])} style={ghostBtn()}>+ Add line</button>
    </div>
  )
}

function PriceHintList({ items }) {
  if (!items?.length) return <Note>All identified materials have confirmed prices.</Note>
  return (
    <ul style={{ margin: '0 0 10px 18px', color: C.text, fontSize: 12.5 }}>
      {items.map(p => (
        <li key={p.id}>{p.material} — {p.specification || 'spec required'} ({p.unit}) {p.marketStatus === 'manual_entry_required' ? '· manual entry required' : ''}</li>
      ))}
    </ul>
  )
}

function MiniTable({ rows, cols }) {
  if (!rows?.length) return <Note>None</Note>
  return (
    <table style={{ ...tableStyle(), marginBottom: 10 }}>
      <thead><tr>{cols.map(c => <th key={c} style={thStyle()}>{c}</th>)}</tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id}>
            {cols.map(c => <td key={c} style={tdStyle()}>{r[c] || '—'}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function StyleCard({ title, desc, selected, onClick }) {
  return (
    <button onClick={onClick} style={{
      textAlign: 'left', padding: 16, borderRadius: 10, cursor: 'pointer',
      background: selected ? C.amberGlow : C.slate,
      border: `2px solid ${selected ? C.amber : C.border}`,
      color: C.text,
    }}>
      <div style={{ fontWeight: 700, color: C.amber, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5 }}>{desc}</div>
    </button>
  )
}

function ReviewRow({ label, value, warn, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
      <span style={{ color: C.textDim }}>{label}</span>
      <span style={{ color: warn ? C.red : highlight ? C.amber : C.text, fontFamily: "'IBM Plex Mono'" }}>{value}</span>
    </div>
  )
}

function primaryBtn() {
  return { background: C.amber, color: '#070A0D', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, cursor: 'pointer' }
}
function ghostBtn() {
  return { background: 'transparent', color: C.textDim, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }
}
function tableStyle() { return { width: '100%', borderCollapse: 'collapse', fontSize: 12 } }
function thStyle() { return { textAlign: 'left', padding: '6px 8px', borderBottom: `1px solid ${C.border}`, color: C.amber, fontFamily: "'IBM Plex Mono'", fontSize: 10 } }
function tdStyle() { return { padding: '6px 8px', borderBottom: `1px solid ${C.border}`, color: C.text } }
function inputStyle(width = '100%') { return { width, background: C.slate, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, padding: '6px 8px', fontSize: 12 } }
