import { C, BOQ_SECTIONS } from '../../utils/constants.js'
import EstimateAuditPanel from '../shared/EstimateAuditPanel.jsx'

export default function BOQPage({ boq, onSendToDocGen, onAIReview, onUnlockEstimate, onApproveEstimate, aiBusy }) {
  const { rows, filtered, section, setSection, totals, pricingAudit, projectEstimate, update, addRow, removeRow, duplicateRow, clear } = boq

  const fmtN = (n) => n ? Number(n).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'

  const footerRows = [
    ['PROJECT SUBTOTAL', totals.projectSubtotal ?? totals.sub, false],
    totals.cont > 0 && ['CONTINGENCY', totals.cont, false],
    totals.oh > 0 && ['CONTRACTOR OVERHEADS', totals.oh, false],
    totals.profit > 0 && ['CONTRACTOR PROFIT', totals.profit, false],
    totals.vat > 0 && ['VAT', totals.vat, false],
    totals.discount > 0 && ['DISCOUNT', -totals.discount, false],
    ['FINAL CONTRACT SUM', totals.grand, true],
  ].filter(Boolean)

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {/* Stat bar */}
      <div style={{ display: 'flex', gap: 20, padding: '10px 20px', background: C.carbon, borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        {[
          ['Lines', rows.length],
          [`GHS ${fmtN(totals.projectSubtotal ?? totals.sub)}`, 'Project Subtotal'],
          [`GHS ${fmtN(totals.grand)}`, 'Contract Sum', C.gold],
        ].map(([val, lbl, color]) => (
          <div key={lbl}>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 16, color: color || C.amber, fontWeight: 500 }}>{typeof val === 'number' ? val : val}</div>
            <div style={{ fontSize: 9.5, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1 }}>{lbl}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: 20 }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 25, letterSpacing: 2, color: C.amber, marginBottom: 3 }}>BOQ BUILDER</div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button onClick={() => addRow(section === 'All' ? 'General' : section)} style={btn('primary')}>+ Add Row</button>
          <button onClick={() => onAIReview?.(rows)} disabled={aiBusy} style={{ ...btn('sky'), opacity: aiBusy ? 0.5 : 1, cursor: aiBusy ? 'not-allowed' : 'pointer' }}>
            {aiBusy ? '⏳ AI working…' : '🤖 AI Review'}
          </button>
          <button onClick={() => onSendToDocGen?.(rows)} style={btn('green')}>→ QS Review & Export</button>
          <button onClick={clear} style={btn('outline')}>Clear</button>
        </div>

        {/* Section tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {['All', ...BOQ_SECTIONS].map(s => (
            <div key={s} onClick={() => setSection(s)}
              style={{ display: 'inline-flex', alignItems: 'center', background: section === s ? C.amberGlow : C.panel, border: `1px solid ${section === s ? C.amber : C.border}`, color: section === s ? C.amber : C.textDim, borderRadius: 20, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
              {s}
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>
                {['#', 'Section', 'Description', 'Unit', 'Qty', 'Rate (GHS)', 'Amount (GHS)', 'Client$', ''].map(h => (
                  <th key={h} style={{ background: C.slate, color: C.amber, padding: '7px 9px', textAlign: 'left', border: `1px solid ${C.border}`, fontFamily: "'IBM Plex Mono'", fontSize: 10, letterSpacing: '.7px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={row.id} style={{ background: row.clientSupplied ? 'rgba(56,189,248,.04)' : 'transparent' }}>
                  <td style={{ border: `1px solid ${C.border}`, padding: '4px 8px', fontFamily: "'IBM Plex Mono'", fontSize: 10, color: C.textFaint }}>{i + 1}</td>
                  <td style={{ border: `1px solid ${C.border}`, padding: '4px 8px' }}>
                    <select value={row.section} onChange={e => update(row.id, 'section', e.target.value)}
                      style={{ background: 'transparent', border: 'none', outline: 'none', color: C.textDim, fontSize: 12, width: '100%' }}>
                      {BOQ_SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={{ border: `1px solid ${C.border}`, padding: '4px 8px' }}>
                    <input value={row.desc} onChange={e => update(row.id, 'desc', e.target.value)}
                      placeholder="Work item description…"
                      style={{ background: 'transparent', border: 'none', outline: 'none', color: C.text, fontSize: 12.5, width: '100%' }} />
                    {row.clientSupplied && <span style={{ background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.3)', borderRadius: 4, padding: '1px 5px', fontSize: 10, color: C.sky, fontFamily: "'IBM Plex Mono'", marginLeft: 5 }}>CLIENT SUPPLY</span>}
                  </td>
                  <td style={{ border: `1px solid ${C.border}`, padding: '4px 8px' }}>
                    <select value={row.unit} onChange={e => update(row.id, 'unit', e.target.value)}
                      style={{ background: 'transparent', border: 'none', outline: 'none', color: C.text, fontSize: 12, width: '100%' }}>
                      {['m²', 'm³', 'm', 'nr', 'kg', 'tonnes', 'lm', 'ls', 'bags', 'sheets'].map(u => <option key={u}>{u}</option>)}
                    </select>
                  </td>
                  <td style={{ border: `1px solid ${C.border}`, padding: '4px 8px' }}>
                    <input value={row.qty} onChange={e => update(row.id, 'qty', e.target.value)}
                      style={{ background: 'transparent', border: 'none', outline: 'none', color: C.text, fontSize: 12.5, width: '100%', textAlign: 'right' }} />
                  </td>
                  <td style={{ border: `1px solid ${C.border}`, padding: '4px 8px' }}>
                    <input value={row.clientSupplied ? '0.00' : row.rate} onChange={e => update(row.id, 'rate', e.target.value)}
                      disabled={row.clientSupplied}
                      style={{ background: 'transparent', border: 'none', outline: 'none', color: row.clientSupplied ? C.textFaint : C.text, fontSize: 12.5, width: '100%', textAlign: 'right' }} />
                  </td>
                  <td style={{ border: `1px solid ${C.border}`, padding: '4px 8px', fontFamily: "'IBM Plex Mono'", fontSize: 12, textAlign: 'right', color: row.clientSupplied ? C.sky : C.amber }}>
                    {row.amount ? fmtN(parseFloat(row.amount)) : '—'}
                  </td>
                  <td style={{ border: `1px solid ${C.border}`, padding: '4px 8px', textAlign: 'center' }}>
                    <input type="checkbox" checked={row.clientSupplied} onChange={e => update(row.id, 'clientSupplied', e.target.checked)} />
                  </td>
                  <td style={{ border: `1px solid ${C.border}`, padding: '4px 8px', whiteSpace: 'nowrap' }}>
                    <button onClick={() => duplicateRow(row.id)} title="Duplicate row"
                      style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textDim, fontSize: 11.5, padding: '3px 8px', cursor: 'pointer', borderRadius: 4, marginRight: 4 }}>⧉</button>
                    <button
                      onClick={() => removeRow(row.id)}
                      disabled={row.locked || row.deletable === false}
                      title={row.locked ? 'Locked row' : 'Remove row'}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${C.border}`,
                        color: row.locked || row.deletable === false ? C.textFaint : C.red,
                        fontSize: 11.5,
                        padding: '3px 8px',
                        cursor: row.locked || row.deletable === false ? 'not-allowed' : 'pointer',
                        borderRadius: 4,
                        opacity: row.locked || row.deletable === false ? 0.4 : 1,
                      }}
                    >✕</button>
                  </td>
                </tr>
              ))}

              {/* Totals */}
              {footerRows.map(([label, val, isGrand]) => (
                <tr key={label}>
                  <td colSpan={6} style={{ textAlign: 'right', padding: '6px 9px', background: C.slate, fontFamily: "'IBM Plex Mono'", fontSize: 10, letterSpacing: 1, color: isGrand ? C.gold : C.textDim, border: `1px solid ${C.border}` }}>{label}</td>
                  <td style={{ fontFamily: "'IBM Plex Mono'", textAlign: 'right', fontSize: isGrand ? 15 : 12, color: isGrand ? C.gold : (val < 0 ? C.red : C.textDim), background: C.slate, border: `1px solid ${C.border}` }}>GHS {fmtN(Math.abs(val))}</td>
                  <td colSpan={2} style={{ background: C.slate, border: `1px solid ${C.border}` }} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <EstimateAuditPanel
          projectEstimate={projectEstimate}
          onUnlock={onUnlockEstimate}
          onApprove={onApproveEstimate}
        />
      </div>
    </div>
  )
}

function btn(variant = 'outline') {
  const base = { padding: '7px 14px', borderRadius: 6, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all .15s' }
  const map = {
    primary: { ...base, background: C.amber, color: '#070A0D' },
    sky:     { ...base, background: 'transparent', border: `1px solid ${C.sky}`, color: C.sky },
    green:   { ...base, background: 'transparent', border: `1px solid ${C.green}`, color: C.green },
    outline: { ...base, background: 'transparent', border: `1px solid ${C.border}`, color: C.textDim },
  }
  return map[variant] || base
}

