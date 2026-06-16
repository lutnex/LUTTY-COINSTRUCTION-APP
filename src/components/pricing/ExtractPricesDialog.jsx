import { useState, useEffect } from 'react'
import { C } from '../../utils/constants.js'
import { CATEGORY_LABELS, SOURCE_LABELS } from '../../utils/priceProfileTypes.js'

/** Editable table for prices extracted from chat — review before saving to profile. */
export default function ExtractPricesDialog({ open, items: initialItems = [], onConfirm, onCancel }) {
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!open) return
    setItems(initialItems.map(it => ({ ...it })))
  }, [open, initialItems])

  if (!open) return null

  const updateItem = (id, field, value) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))
  }

  const removeItem = (id) => setItems(prev => prev.filter(it => it.id !== id))

  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: C.amber, letterSpacing: 1.5, marginBottom: 6 }}>EXTRACT PRICES FROM CHAT</div>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 14 }}>
          Review agreed rates before saving. Edit or remove any line before confirming.
        </div>

        <div style={{ overflowX: 'auto', maxHeight: 380, marginBottom: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Item', 'Specification', 'Unit', 'Rate (GHS)', 'Category', 'Source', 'Notes', ''].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id}>
                  <td style={td}><input value={it.material} onChange={e => updateItem(it.id, 'material', e.target.value)} style={cellInp} /></td>
                  <td style={td}><input value={it.specification || ''} onChange={e => updateItem(it.id, 'specification', e.target.value)} style={cellInp} /></td>
                  <td style={td}><input value={it.unit} onChange={e => updateItem(it.id, 'unit', e.target.value)} style={{ ...cellInp, width: 56 }} /></td>
                  <td style={td}><input value={it.price} onChange={e => updateItem(it.id, 'price', e.target.value)} style={{ ...cellInp, width: 72 }} /></td>
                  <td style={td}>
                    <select value={it.category} onChange={e => updateItem(it.id, 'category', e.target.value)} style={cellInp}>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td style={td}>
                    <select value={it.source || 'user_agreed'} onChange={e => updateItem(it.id, 'source', e.target.value)} style={cellInp}>
                      {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td style={td}><input value={it.notes || ''} onChange={e => updateItem(it.id, 'notes', e.target.value)} style={cellInp} /></td>
                  <td style={td}><button type="button" onClick={() => removeItem(it.id)} style={btn('red')}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && <div style={{ padding: 20, textAlign: 'center', color: C.textDim, fontSize: 12 }}>No prices extracted</div>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onCancel} style={btn('outline')}>Cancel</button>
          <button type="button" onClick={() => onConfirm?.(items)} disabled={!items.length} style={{ ...btn('primary'), opacity: items.length ? 1 : 0.5 }}>
            Confirm Extracted Prices
          </button>
        </div>
      </div>
    </div>
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(7,10,13,.88)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 360 }
const panel = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 22, maxWidth: 980, width: '96vw', maxHeight: '92vh', overflowY: 'auto' }
const cellInp = { background: '#141B24', border: '1px solid #253040', borderRadius: 6, color: '#DDE5F0', fontFamily: 'DM Sans', fontSize: 11.5, padding: '5px 7px', outline: 'none', width: '100%' }
const th = { textAlign: 'left', padding: '6px 8px', borderBottom: `1px solid ${C.border}`, color: C.amber, fontFamily: "'IBM Plex Mono'", fontSize: 10 }
const td = { padding: '5px 6px', borderBottom: `1px solid ${C.border}`, verticalAlign: 'top' }

function btn(v) {
  const base = { padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'DM Sans' }
  if (v === 'primary') return { ...base, background: C.amber, color: '#070A0D' }
  if (v === 'red') return { ...base, background: 'rgba(248,113,113,.12)', color: C.red, padding: '4px 8px', fontSize: 11 }
  return { ...base, background: 'transparent', border: `1px solid ${C.border}`, color: C.textDim }
}
