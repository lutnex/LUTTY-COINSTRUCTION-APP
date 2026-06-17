import { C } from '../../utils/constants.js'
import { Button } from '../shared/Button.jsx'
import { fmtGHS, fmtN } from '../../utils/formatters.js'
import {
  CHANGE_TYPE_OPTIONS,
  ITEM_STATUS_OPTIONS,
} from '../../utils/variationOrderTypes.js'
import { formatRevisionLabel } from '../../utils/docGenVariationTypes.js'

const thStyle = {
  background: C.slate, color: C.amber, padding: '6px 8px', textAlign: 'left',
  border: `1px solid ${C.border}`, fontFamily: 'IBM Plex Mono', fontSize: 9, whiteSpace: 'nowrap',
}
const tdStyle = { border: `1px solid ${C.border}`, padding: '4px 6px', verticalAlign: 'top' }
const inputStyle = {
  background: '#141B24', border: `1px solid #253040`, borderRadius: 4, color: '#DDE5F0',
  fontFamily: 'DM Sans', fontSize: 11, padding: '4px 6px', outline: 'none', width: '100%',
}

export function DocGenVariationPanel({
  variationDraft,
  calculations,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onUndo,
  canUndo,
  onUpdateNotes,
  onPreview,
  onClear,
}) {
  if (!variationDraft) return null

  const calc = calculations || {}
  const items = variationDraft.items || []

  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.amberLo}`, borderRadius: 10,
      padding: 16, marginBottom: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 18, color: C.amber, letterSpacing: 1 }}>
            VARIATION SCHEDULE — {formatRevisionLabel(variationDraft.revisionNumber || 1)}
          </div>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>
            Original total: {fmtGHS(variationDraft.originalTotal)}
            {variationDraft.variationNumber ? ` · ${variationDraft.variationNumber}` : ''}
            {variationDraft.originalDocumentId ? ' · Original document preserved' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Button size="sm" onClick={onAddItem}>+ Add Line</Button>
          {canUndo && <Button size="sm" variant="outline" onClick={onUndo}>↩ Undo</Button>}
          <Button size="sm" variant="sky" onClick={onPreview} disabled={!items.length}>Preview Revised</Button>
          <Button size="sm" variant="ghost" onClick={onClear}>Discard Draft</Button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', marginBottom: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              {[
                '#', 'Orig Ref', 'Change', 'Description',
                'Orig Qty', 'Rev Qty', 'Unit', 'Orig Rate', 'Rev Rate',
                'Orig Amt', 'Var +/-', 'Reason', 'In Total', 'Status', '',
              ].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={15} style={{ ...tdStyle, textAlign: 'center', color: C.textFaint, padding: 20 }}>
                  No variation items yet — add lines manually or import from a Variation Order / AI chat.
                </td>
              </tr>
            ) : items.map(item => (
              <tr key={item.id}>
                <td style={{ ...tdStyle, fontFamily: 'IBM Plex Mono', fontSize: 10, color: C.textFaint }}>{item.itemNo}</td>
                <td style={tdStyle}>
                  <input value={item.originalItemRef || ''} onChange={e => onUpdateItem(item.id, { originalItemRef: e.target.value })} style={inputStyle} />
                </td>
                <td style={tdStyle}>
                  <select value={item.changeType} onChange={e => onUpdateItem(item.id, { changeType: e.target.value })} style={{ ...inputStyle, minWidth: 100 }}>
                    {CHANGE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td style={{ ...tdStyle, minWidth: 130 }}>
                  <input value={item.description || ''} onChange={e => onUpdateItem(item.id, { description: e.target.value })} style={inputStyle} placeholder="Description…" />
                </td>
                <td style={tdStyle}><input value={item.originalQty || ''} onChange={e => onUpdateItem(item.id, { originalQty: e.target.value })} style={{ ...inputStyle, width: 48 }} /></td>
                <td style={tdStyle}><input value={item.revisedQty || ''} onChange={e => onUpdateItem(item.id, { revisedQty: e.target.value })} style={{ ...inputStyle, width: 48 }} /></td>
                <td style={tdStyle}><input value={item.unit || ''} onChange={e => onUpdateItem(item.id, { unit: e.target.value })} style={{ ...inputStyle, width: 40 }} /></td>
                <td style={tdStyle}><input value={item.originalRate || ''} onChange={e => onUpdateItem(item.id, { originalRate: e.target.value })} style={{ ...inputStyle, width: 58 }} /></td>
                <td style={tdStyle}><input value={item.revisedRate || ''} onChange={e => onUpdateItem(item.id, { revisedRate: e.target.value })} style={{ ...inputStyle, width: 58 }} /></td>
                <td style={{ ...tdStyle, fontFamily: 'IBM Plex Mono', fontSize: 10, textAlign: 'right' }}>{fmtN(item.originalAmount)}</td>
                <td style={{
                  ...tdStyle, fontFamily: 'IBM Plex Mono', fontSize: 10, textAlign: 'right',
                  color: item.difference > 0 ? C.green : item.difference < 0 ? C.red : C.textDim,
                }}>
                  {item.difference > 0 ? '+' : ''}{fmtN(item.difference)}
                </td>
                <td style={tdStyle}>
                  <input value={item.reason || ''} onChange={e => onUpdateItem(item.id, { reason: e.target.value })} style={inputStyle} placeholder="Client instruction…" />
                </td>
                <td style={tdStyle}>
                  <select
                    value={item.includeInTotal === false ? 'no' : 'yes'}
                    onChange={e => onUpdateItem(item.id, { includeInTotal: e.target.value === 'yes' })}
                    style={inputStyle}
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </td>
                <td style={tdStyle}>
                  <select value={item.status || 'pending'} onChange={e => onUpdateItem(item.id, { status: e.target.value })} style={inputStyle}>
                    {ITEM_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td style={tdStyle}><Button size="sm" variant="red" onClick={() => onRemoveItem(item.id)}>✕</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 14, alignItems: 'start' }}>
        <div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: C.amber, marginBottom: 6 }}>USER NOTES / ASSUMPTIONS</div>
          <textarea
            value={variationDraft.userNotes || ''}
            onChange={e => onUpdateNotes?.(e.target.value)}
            rows={3}
            style={{
              width: '100%', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '8px 10px', color: C.text, fontSize: 12, resize: 'vertical', outline: 'none',
            }}
            placeholder="Assumptions, exclusions, provisional sums, client instructions…"
          />
        </div>
        <div style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: C.amber, marginBottom: 10 }}>REVISED TOTALS</div>
          {[
            ['Additions', calc.totalAdditions, C.green],
            ['Omissions', calc.totalOmissions, C.red, true],
            ['Reductions', calc.totalReductions, C.red, true],
            ['Increases', calc.totalIncreases, C.green],
            ['Net Variation', calc.netVariation, calc.netVariation >= 0 ? C.green : C.red],
          ].map(([label, val, color, negate]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
              <span style={{ color: C.textDim }}>{label}</span>
              <span style={{ fontFamily: 'IBM Plex Mono', color: color || C.text }}>
                {negate && val ? '− ' : ''}{fmtGHS(val)}
              </span>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: C.amber, fontSize: 11, fontWeight: 600 }}>Revised Total</span>
            <span style={{ fontFamily: 'IBM Plex Mono', color: C.amber, fontSize: 13 }}>{fmtGHS(calc.revisedTotal)}</span>
          </div>
          {(calc.excludedOptional > 0 || calc.excludedProvisional > 0) && (
            <div style={{ fontSize: 10, color: C.textFaint, marginTop: 8 }}>
              Excluded optional: {fmtGHS(calc.excludedOptional)} · Excluded provisional: {fmtGHS(calc.excludedProvisional)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
