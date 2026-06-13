import { useState } from 'react'
import { C } from '../../utils/constants.js'

export default function PriceCompareDialog({ open, conflicts = [], onResolve, onCancel }) {
  const [choices, setChoices] = useState({})

  if (!open) return null

  const setChoice = (id, choice) => setChoices(prev => ({ ...prev, [id]: choice }))

  const handleConfirm = () => {
    const resolved = conflicts.map(c => ({
      ...c,
      choice: choices[c.id] || 'profile',
    }))
    onResolve?.(resolved)
  }

  const allChosen = conflicts.every(c => choices[c.id])

  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: C.amber, letterSpacing: 1.5, marginBottom: 6 }}>COMPARE PROFILE VS MARKET</div>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 14 }}>Choose a rate for each item. Differences are shown — no rate is applied until you confirm.</div>

        <div style={{ overflowX: 'auto', maxHeight: 400 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Material', 'Profile rate', 'Live rate', 'Diff', 'Profile updated', 'Supplier', 'Your choice'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {conflicts.map(c => (
                <tr key={c.id}>
                  <td style={td}>{c.material}</td>
                  <td style={td}>GHS {c.profileRate} {c.profileUnit}</td>
                  <td style={td}>GHS {c.liveRate} {c.liveUnit}</td>
                  <td style={{ ...td, color: c.difference > 0 ? C.red : C.green }}>{c.difference > 0 ? '+' : ''}{c.difference}</td>
                  <td style={td}>{c.profileUpdated || '—'}</td>
                  <td style={td}>{c.liveSupplier || '—'}</td>
                  <td style={td}>
                    <select value={choices[c.id] || ''} onChange={e => setChoice(c.id, e.target.value)} style={sel}>
                      <option value="">Select…</option>
                      <option value="profile">Use profile rate</option>
                      <option value="live">Use live market rate</option>
                      <option value="manual">Override manually</option>
                      <option value="provisional">Mark provisional</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button type="button" onClick={onCancel} style={btn}>Cancel</button>
          <button type="button" onClick={handleConfirm} disabled={!allChosen} style={{ ...btn, background: C.amber, color: '#070A0D', opacity: allChosen ? 1 : 0.5 }}>
            Apply chosen rates
          </button>
        </div>
      </div>
    </div>
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(7,10,13,.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 370 }
const panel = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 22, maxWidth: 920, width: '96vw' }
const th = { textAlign: 'left', padding: '6px 8px', borderBottom: `1px solid ${C.border}`, color: C.amber, fontFamily: "'IBM Plex Mono'", fontSize: 10 }
const td = { padding: '6px 8px', borderBottom: `1px solid ${C.border}`, color: C.text }
const sel = { background: C.slate, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, padding: '5px 8px', fontSize: 11.5, width: '100%' }
const btn = { padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'DM Sans' }
