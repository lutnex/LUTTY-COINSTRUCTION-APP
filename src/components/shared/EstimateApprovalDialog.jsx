import { useState, Fragment } from 'react'
import { C } from '../../utils/constants.js'
import { Button } from './Button.jsx'
import { APPROVAL_MODES } from '../../utils/projectEstimate.js'
import { BREAKDOWN_LABELS, DIRECT_COST_ONLY_KEYS } from '../../services/pricing/directCostBreakdown.js'
import { fmtN } from '../../utils/formatters.js'
import MaterialAuditDialog from './MaterialAuditDialog.jsx'

const MODE_OPTIONS = [
  { id: APPROVAL_MODES.DIRECT_ONLY, label: 'Direct Cost Only', desc: 'Materials + Labour + Earthworks + Filling + Transport + Preliminaries only.' },
  { id: APPROVAL_MODES.PRELIMINARIES, label: 'Add Preliminaries', desc: 'Include explicit preliminaries already in the estimate.' },
  { id: APPROVAL_MODES.OVERHEADS, label: 'Add Overheads', desc: 'Apply contractor overheads percentage on subtotal.' },
  { id: APPROVAL_MODES.PROFIT, label: 'Add Profit', desc: 'Apply contractor profit percentage on subtotal.' },
  { id: APPROVAL_MODES.CONTINGENCY, label: 'Add Contingency', desc: 'Apply contingency percentage on subtotal.' },
  { id: APPROVAL_MODES.CUSTOM, label: 'Custom %', desc: 'Set custom percentages for each commercial item.' },
]

const EXTRA_KEYS = ['equipment', 'other', 'overheads', 'profit', 'contingency']

export default function EstimateApprovalDialog({
  open,
  onClose,
  onConfirm,
  directCostTotal = 0,
  breakdown = null,
  materialAudit = null,
  title = 'Approve Estimate',
  subtitle = 'Use Direct Cost Only or Include Commercials?',
}) {
  const [materialAuditOpen, setMaterialAuditOpen] = useState(false)
  const [selected, setSelected] = useState([APPROVAL_MODES.DIRECT_ONLY])
  const [customPercentages, setCustomPercentages] = useState({
    contingency: '',
    overheads: '',
    profit: '',
    vat: '',
  })

  if (!open) return null

  const categories = breakdown?.categories || {}
  const formula = breakdown?.formula
  const dedupeNotes = breakdown?.dedupeNotes || []
  const warnings = breakdown?.warnings || []
  const auditLog = breakdown?.auditLog || []
  const displayTotal = breakdown?.directTotal ?? directCostTotal

  const toggleMode = (mode) => {
    if (mode === APPROVAL_MODES.DIRECT_ONLY) {
      setSelected([APPROVAL_MODES.DIRECT_ONLY])
      return
    }
    setSelected(prev => {
      const without = prev.filter(m => m !== APPROVAL_MODES.DIRECT_ONLY)
      if (without.includes(mode)) {
        const next = without.filter(m => m !== mode)
        return next.length ? next : [APPROVAL_MODES.DIRECT_ONLY]
      }
      return [...without, mode]
    })
  }

  const showCustom = selected.includes(APPROVAL_MODES.CUSTOM)
    || selected.some(m => [APPROVAL_MODES.OVERHEADS, APPROVAL_MODES.PROFIT, APPROVAL_MODES.CONTINGENCY].includes(m))

  const handleConfirm = () => {
    onConfirm?.({
      modes: selected,
      mode: selected.length === 1 ? selected[0] : selected.join('+'),
      customPercentages: showCustom ? customPercentages : {},
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(7,10,13,.85)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
    }}>
      <div style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: 24, width: 620, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: C.amber, letterSpacing: '1.5px', marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>{subtitle}</div>
        <div style={{
          background: C.carbon, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 12, color: C.textDim }}>Current Direct Cost</span>
          <span style={{ fontFamily: "'IBM Plex Mono'", color: C.amber, fontWeight: 600 }}>
            GHS {fmtN(displayTotal)}
          </span>
        </div>

        {warnings.length > 0 && (
          <div style={{
            background: 'rgba(220,80,60,.12)', border: '1px solid rgba(220,80,60,.35)',
            borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 11, color: '#F0A090',
          }}>
            {warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
          </div>
        )}

        <div style={{
          background: C.carbon, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: '12px 14px', marginBottom: 12,
        }}>
          <div style={{ fontSize: 11, color: C.textDim, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            Calculation Audit
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '4px 12px', fontSize: 11 }}>
            <div style={{ color: C.textFaint, fontWeight: 600 }}>Source</div>
            <div style={{ color: C.textFaint, fontWeight: 600, textAlign: 'right' }}>Value</div>
            <div style={{ color: C.textFaint, fontWeight: 600, textAlign: 'right' }}>Origin</div>
            {auditLog.map(row => (
              <Fragment key={row.category}>
                <div style={{ color: C.textDim }}>{row.label}</div>
                <div style={{ fontFamily: "'IBM Plex Mono'", textAlign: 'right', color: row.value > 0 ? C.text : C.textFaint }}>
                  GHS {fmtN(row.value)}
                </div>
                <div style={{ textAlign: 'right', color: C.textFaint, fontSize: 10 }}>
                  {row.origin}
                </div>
              </Fragment>
            ))}
          </div>
        </div>

        <div style={{
          background: C.carbon, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: '12px 14px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, color: C.textDim, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            Cost Breakdown
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[...DIRECT_COST_ONLY_KEYS, ...EXTRA_KEYS].map(key => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: C.textDim }}>{BREAKDOWN_LABELS[key]}</span>
                <span style={{ fontFamily: "'IBM Plex Mono'", color: categories[key] > 0 ? C.text : C.textFaint }}>
                  GHS {fmtN(categories[key] || 0)}
                </span>
              </div>
            ))}
          </div>
          {formula?.expression && (
            <div style={{
              marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`,
              fontSize: 11, color: C.textDim, lineHeight: 1.5, fontFamily: "'IBM Plex Mono'",
            }}>
              <div style={{ marginBottom: 4, color: C.textFaint }}>Formula</div>
              <div>{formula.expression}</div>
              <div style={{ marginTop: 6, color: C.amber }}>= GHS {fmtN(formula.total ?? displayTotal)}</div>
            </div>
          )}
          {dedupeNotes.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 10, color: C.textFaint, lineHeight: 1.4 }}>
              {dedupeNotes.map((note, i) => (
                <div key={i}>• {note}</div>
              ))}
            </div>
          )}
          {materialAudit && (
            <div style={{ marginTop: 12 }}>
              <Button variant="ghost" onClick={() => setMaterialAuditOpen(true)}>
                Show Material Audit
              </Button>
              {Math.abs(materialAudit.difference) > 0.02 && (
                <span style={{ fontSize: 10, color: '#F0A090', marginLeft: 10 }}>
                  Materials differ by GHS {fmtN(materialAudit.difference)} from import
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {MODE_OPTIONS.map(opt => (
            <label
              key={opt.id}
              style={{
                display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px',
                background: selected.includes(opt.id) ? C.amberGlow : C.panel2,
                border: `1px solid ${selected.includes(opt.id) ? C.amberLo : C.border}`,
                borderRadius: 8, cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.id)}
                onChange={() => toggleMode(opt.id)}
                style={{ marginTop: 3 }}
              />
              <div>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 3, lineHeight: 1.4 }}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>

        {showCustom && (
          <div style={{
            background: C.carbon, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: 14, marginBottom: 16,
          }}>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
              Custom Percentages (%)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {['contingency', 'overheads', 'profit', 'vat'].map(key => (
                <div key={key}>
                  <div style={{ fontSize: 10, color: C.textFaint, marginBottom: 4, textTransform: 'capitalize' }}>{key}</div>
                  <input
                    type="text"
                    value={customPercentages[key]}
                    onChange={e => setCustomPercentages(p => ({ ...p, [key]: e.target.value }))}
                    placeholder="e.g. 10"
                    style={{
                      width: '100%', background: '#141B24', border: '1px solid #253040',
                      borderRadius: 6, color: '#DDE5F0', padding: '6px 8px', fontSize: 12,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleConfirm}>Approve &amp; Lock Estimate</Button>
        </div>
      </div>

      <MaterialAuditDialog
        open={materialAuditOpen}
        onClose={() => setMaterialAuditOpen(false)}
        audit={materialAudit}
      />
    </div>
  )
}
