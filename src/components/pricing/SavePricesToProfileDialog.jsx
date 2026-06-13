import { useState, useEffect } from 'react'
import { C } from '../../utils/constants.js'
import { CATEGORY_LABELS, SOURCE_LABELS } from '../../utils/priceProfileTypes.js'
import { detectProfileConflicts } from '../../utils/priceStore.js'

export default function SavePricesToProfileDialog({
  open,
  items: initialItems = [],
  profiles = [],
  activeProfileId,
  onSave,
  onCancel,
  onCreateProfile,
}) {
  const [items, setItems] = useState([])
  const [profileId, setProfileId] = useState(activeProfileId)
  const [newProfileName, setNewProfileName] = useState('')
  const [conflicts, setConflicts] = useState([])
  const [conflictMode, setConflictMode] = useState('ask')

  useEffect(() => {
    if (!open) return
    setItems(initialItems.map(it => ({ ...it })))
    setProfileId(activeProfileId)
    setConflictMode('ask')
    setNewProfileName('')
  }, [open, initialItems, activeProfileId])

  useEffect(() => {
    if (!open || !profileId) return
    const profile = profiles.find(p => p.id === profileId)
    if (!profile) return
    setConflicts(detectProfileConflicts(profile.items, items))
  }, [open, profileId, profiles, items])

  if (!open) return null

  const updateItem = (id, field, value) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))
  }

  const removeItem = (id) => setItems(prev => prev.filter(it => it.id !== id))

  const handleCreateProfile = () => {
    if (!newProfileName.trim()) return
    const id = onCreateProfile?.(newProfileName.trim())
    if (id) setProfileId(id)
    setNewProfileName('')
  }

  const handleSave = () => {
    if (!items.length) return
    if (conflicts.length && conflictMode === 'ask') return
    onSave?.({
      profileId,
      items,
      conflictMode: conflicts.length ? conflictMode : 'replace',
    })
  }

  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: C.amber, letterSpacing: 1.5, marginBottom: 6 }}>SAVE PRICES TO PROFILE</div>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 14 }}>Review agreed prices before saving. Nothing is saved until you confirm.</div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={lbl}>Target Price Profile</label>
            <select value={profileId} onChange={e => setProfileId(e.target.value)} style={inp}>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.name} ({p.items?.length || 0} rates)</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={newProfileName} onChange={e => setNewProfileName(e.target.value)} placeholder="New profile name" style={{ ...inp, width: 160 }} />
            <button type="button" onClick={handleCreateProfile} style={btn('outline')}>+ Create</button>
          </div>
        </div>

        {conflicts.length > 0 && (
          <div style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: C.amber, fontWeight: 600, marginBottom: 8 }}>⚠ {conflicts.length} existing rate(s) differ — choose how to save:</div>
            {conflicts.slice(0, 4).map(c => (
              <div key={c.existing.id} style={{ fontSize: 11.5, color: C.textDim, marginBottom: 4 }}>
                {c.incoming.material}: profile GHS {c.existing.price} → new GHS {c.incoming.price} ({c.difference > 0 ? '+' : ''}{c.difference})
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {[
                ['replace', 'Replace existing rate'],
                ['keep_both', 'Keep both as dated rates'],
                ['skip', 'Skip conflicting items'],
              ].map(([mode, label]) => (
                <button key={mode} type="button" onClick={() => setConflictMode(mode)} style={{
                  ...btn(conflictMode === mode ? 'primary' : 'outline'),
                  fontSize: 11,
                }}>{label}</button>
              ))}
            </div>
          </div>
        )}

        <div style={{ overflowX: 'auto', maxHeight: 340, marginBottom: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Item', 'Spec', 'Unit', 'Price', 'Category', 'Supplier', 'Notes', ''].map(h => (
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
                  <td style={td}><input value={it.supplier || ''} onChange={e => updateItem(it.id, 'supplier', e.target.value)} style={cellInp} /></td>
                  <td style={td}><input value={it.notes || ''} onChange={e => updateItem(it.id, 'notes', e.target.value)} style={cellInp} /></td>
                  <td style={td}><button type="button" onClick={() => removeItem(it.id)} style={btn('red')}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && <div style={{ padding: 20, textAlign: 'center', color: C.textDim, fontSize: 12 }}>No prices to save</div>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onCancel} style={btn('outline')}>Cancel</button>
          <button type="button" onClick={handleSave} disabled={!items.length || (conflicts.length > 0 && conflictMode === 'ask')} style={{ ...btn('primary'), opacity: !items.length ? 0.5 : 1 }}>
            Confirm Save to Profile
          </button>
        </div>
      </div>
    </div>
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(7,10,13,.88)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 360 }
const panel = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 22, maxWidth: 960, width: '96vw', maxHeight: '92vh', overflowY: 'auto' }
const lbl = { display: 'block', fontSize: 10, color: C.textDim, fontFamily: "'IBM Plex Mono'", textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }
const inp = { background: '#141B24', border: '1px solid #253040', borderRadius: 6, color: '#DDE5F0', fontFamily: 'DM Sans', fontSize: 12.5, padding: '8px 10px', outline: 'none', width: '100%' }
const cellInp = { ...inp, padding: '5px 7px', fontSize: 11.5 }
const th = { textAlign: 'left', padding: '6px 8px', borderBottom: `1px solid ${C.border}`, color: C.amber, fontFamily: "'IBM Plex Mono'", fontSize: 10 }
const td = { padding: '5px 6px', borderBottom: `1px solid ${C.border}`, verticalAlign: 'top' }

function btn(v) {
  const base = { padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'DM Sans' }
  if (v === 'primary') return { ...base, background: C.amber, color: '#070A0D' }
  if (v === 'red') return { ...base, background: 'rgba(248,113,113,.12)', color: C.red, padding: '4px 8px', fontSize: 11 }
  return { ...base, background: 'transparent', border: `1px solid ${C.border}`, color: C.textDim }
}
