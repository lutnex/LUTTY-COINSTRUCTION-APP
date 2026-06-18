import { C } from '../../utils/constants.js'
import { FINANCIAL_ITEM_ORDER, FINANCIAL_ITEM_META, freezeAdjustmentAmount } from '../../utils/financialAdjustments.js'
import { fmtN } from '../../utils/formatters.js'

export default function FinancialAdjustmentsPanel({
  adjustments,
  onChange,
  projectSubtotal = 0,
  adjustmentLines = [],
  finalTotal = 0,
  compact = false,
  locked = false,
}) {
  const updateItem = (id, patch) => {
    if (locked) return
    onChange({
      ...adjustments,
      [id]: { ...adjustments[id], ...patch },
    })
  }

  const toggleLock = (id) => {
    const item = adjustments[id]
    if (!item) return
    if (!item.locked) {
      let running = projectSubtotal
      for (const key of FINANCIAL_ITEM_ORDER) {
        if (key === id) break
        const line = adjustmentLines.find(l => l.id === key)
        if (line) running += line.signed
      }
      const frozen = freezeAdjustmentAmount(item, running, projectSubtotal)
      updateItem(id, frozen)
    } else {
      updateItem(id, { locked: false, frozenAmount: null })
    }
  }

  return (
    <div style={{
      background: compact ? 'transparent' : C.panel,
      border: compact ? 'none' : `1px solid ${C.border}`,
      borderRadius: 10,
      padding: compact ? 0 : 16,
    }}>
      {!compact && (
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 14, letterSpacing: 1, color: C.amber, marginBottom: 12 }}>
          Financial Adjustments
          {locked && (
            <span style={{ fontSize: 10, color: C.textFaint, marginLeft: 10, fontFamily: 'DM Sans' }}>
              (locked — unlock estimate to edit)
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {FINANCIAL_ITEM_ORDER.map((id) => {
          const item = adjustments[id] || {}
          const meta = FINANCIAL_ITEM_META[id]
          const line = adjustmentLines.find(l => l.id === id)
          const computed = line?.amount || 0

          return (
            <div
              key={id}
              style={{
                background: item.enabled ? 'rgba(245,158,11,.04)' : C.carbon,
                border: `1px solid ${item.enabled ? C.amberLo : C.border}`,
                borderRadius: 8,
                padding: '12px 14px',
                opacity: item.enabled ? 1 : 0.85,
                transition: 'all .2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: item.enabled ? 10 : 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.text }}>
                  <input
                    type="checkbox"
                    checked={Boolean(item.enabled)}
                    disabled={locked}
                    onChange={e => updateItem(id, { enabled: e.target.checked })}
                  />
                  {meta.label}
                </label>
                {item.enabled && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: meta.isDeduction ? C.red : C.amber }}>
                      {meta.isDeduction ? '−' : '+'} GHS {fmtN(computed)}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleLock(id)}
                      disabled={locked}
                      title={item.locked ? 'Unlock — allow recalculation' : 'Lock — freeze this value'}
                      style={{
                        background: item.locked ? C.amberGlow : 'transparent',
                        border: `1px solid ${item.locked ? C.amber : C.border}`,
                        borderRadius: 6,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: 14,
                        color: item.locked ? C.amber : C.textDim,
                      }}
                    >
                      {item.locked ? '🔒' : '🔓'}
                    </button>
                  </div>
                )}
              </div>

              {item.enabled && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={lbl}>Mode</div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                      {['fixed', 'percentage'].map(mode => (
                        <label key={mode} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.textDim, cursor: item.locked ? 'not-allowed' : 'pointer' }}>
                          <input
                            type="radio"
                            name={`${id}-mode`}
                            checked={item.mode === mode}
                            disabled={item.locked}
                            onChange={() => updateItem(id, { mode, frozenAmount: null })}
                          />
                          {mode === 'fixed' ? 'Fixed Amount' : 'Percentage'}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={lbl}>Value</div>
                    <input
                      type="text"
                      value={item.value}
                      disabled={item.locked && item.mode === 'fixed'}
                      onChange={e => updateItem(id, { value: e.target.value, frozenAmount: null })}
                      placeholder={item.mode === 'percentage' ? 'e.g. 10' : 'GHS amount'}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{
        marginTop: 16,
        padding: '14px 16px',
        background: 'linear-gradient(135deg,#0A1628,#0A2A43)',
        border: '1px solid #1a3a5c',
        borderRadius: 8,
      }}>
        <div style={summaryRow}>
          <span style={{ color: C.textDim }}>Project Subtotal</span>
          <span style={{ fontFamily: "'IBM Plex Mono'", color: C.text }}>GHS {fmtN(projectSubtotal)}</span>
        </div>
        {adjustmentLines.map(line => (
          <div key={line.id} style={summaryRow}>
            <span style={{ color: C.textDim }}>{line.isDeduction ? '−' : '+'} {line.label}</span>
            <span style={{ fontFamily: "'IBM Plex Mono'", color: line.isDeduction ? C.red : C.text }}>
              GHS {fmtN(line.amount)}
            </span>
          </div>
        ))}
        <div style={{ ...summaryRow, paddingTop: 10, marginTop: 6, borderTop: '1px solid rgba(255,255,255,.12)' }}>
          <span style={{ color: C.gold, fontFamily: "'Bebas Neue'", fontSize: 18, letterSpacing: 1 }}>FINAL CONTRACT SUM</span>
          <span style={{ fontFamily: "'IBM Plex Mono'", color: C.gold, fontSize: 16, fontWeight: 700 }}>GHS {fmtN(finalTotal)}</span>
        </div>
      </div>
    </div>
  )
}

const lbl = { fontSize: 9, color: C.textDim, fontFamily: "'IBM Plex Mono'", textTransform: 'uppercase', letterSpacing: 1 }
const inputStyle = { background: '#141B24', border: '1px solid #253040', borderRadius: 6, color: '#DDE5F0', fontFamily: 'DM Sans', fontSize: 12.5, padding: '7px 9px', outline: 'none', width: '100%', marginTop: 4 }
const summaryRow = { display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }
